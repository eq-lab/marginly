import { Executor } from './execution';
import { Logger } from './logger';
import fetch from 'node-fetch';
import { using } from './resource';

interface HttpGetPriceConfig {
  type: 'http-get';
  label: string;
  direction: 'backward' | 'forward';
  query: string;
}

interface CompositePriceConfig {
  type: 'composite';
  label: string;
  sources: PriceConfig[];
}

type PriceConfig = HttpGetPriceConfig | CompositePriceConfig;

function isHttpGetPriceConfig(priceConfig: PriceConfig): priceConfig is HttpGetPriceConfig {
  return priceConfig.type === 'http-get';
}

function isCompositePriceConfig(priceConfig: PriceConfig): priceConfig is CompositePriceConfig {
  return priceConfig.type === 'composite';
}

export type RootPriceConfig = PriceConfig & { id: string };

export interface PriceGetter {
  getPrice(logger: Logger): Promise<number>;
}

type PriceMapper = (json: any) => number;

function createPriceMapper(path: string[]): PriceMapper {
  return (json: any): number => {

    for (const prop of path) {
      json = json[prop];
    }

    if (isNaN(json)) {
      throw new Error('Price is not a number');
    }

    return json;
  };
}

function parseQuery(query: string): { path: string[], url: string } {
  const regex = /^(\w+)\((.+)\)(.*)$/;

  const match = query.match(regex);

  if (match === null) {
    throw new Error('Failed to parse query');
  }

  const func = match[1];
  const url = match[2];
  const path = match[3].split(/\.|\[|\]/).filter(x => x !== '');

  if (func !== 'json') {
    throw new Error(`Unsupported function ${func}`);
  }

  return {
    path,
    url,
  };
}

export function createPriceGetter(executor: Executor, priceConfig: PriceConfig): PriceGetter {
  if (isHttpGetPriceConfig(priceConfig)) {
    let isBackward: boolean;
    if (priceConfig.direction === 'forward') {
      isBackward = false;
    } else if (priceConfig.direction === 'backward') {
      isBackward = true;
    } else {
      throw new Error('Unknown direction');
    }
    const { url, path } = parseQuery(priceConfig.query);
    const priceMapper = createPriceMapper(path);

    return new HttpGetPriceGetter(executor, priceConfig.label, isBackward, url, priceMapper);
  } else if (isCompositePriceConfig(priceConfig)) {
    return new CompositePriceGetter(priceConfig.label, priceConfig.sources.map(x => createPriceGetter(executor, x)));
  } else {
    throw new Error('Unknown price config type');
  }
}

class HttpGetPriceGetter implements PriceGetter {
  private readonly executor: Executor;
  private readonly label: string;
  private readonly isBackward: boolean;
  private readonly url: string;
  private readonly priceMapper: PriceMapper;

  public constructor(executor: Executor, label: string, isBackward: boolean, url: string, priceMapper: PriceMapper) {
    this.executor = executor;
    this.label = label;
    this.isBackward = isBackward;
    this.url = url;
    this.priceMapper = priceMapper;
  }

  public async getPrice(logger: Logger): Promise<number> {
    return await using(logger.scope(`price-${this.label}`), () => this.fetchPrice(this.url));
  }

  private async fetchPrice(url: string): Promise<number> {
    return await this.executor(async () => {
      const result = await fetch(url);

      if (!result.ok) {
        throw new Error(`Error fetching price`);
      }

      const json = await result.json();

      const price = this.priceMapper(json);

      return this.isBackward ? 1 / price : price;
    });
  }
}

class CompositePriceGetter implements PriceGetter {
  private readonly label: string;
  private readonly priceGetters: PriceGetter[];

  public constructor(label: string, priceGetters: PriceGetter[]) {
    this.label = label;
    this.priceGetters = priceGetters;
  }

  public async getPrice(logger: Logger): Promise<number> {
    return await using(logger.scope(`price-${this.label}`), async (logger) => {
      const prices = await Promise.all(this.priceGetters.map(x => x.getPrice(logger)));

      return prices.reduce((a, b) => a * b, 1);
    });
  }
}