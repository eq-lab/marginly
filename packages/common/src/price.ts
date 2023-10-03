import { Executor } from './execution';
import { Logger } from './logger';
import fetch from 'node-fetch';
import { using } from './resource';
import WebSocket from 'ws';

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

interface LbkexPriceConfig {
  type: 'lbkex';
  label: string;
  priceChain: {
    pair: string;
    direction: 'backward' | 'forward';
  }[];
}

type PriceConfig = HttpGetPriceConfig | CompositePriceConfig | LbkexPriceConfig;

function isHttpGetPriceConfig(priceConfig: PriceConfig): priceConfig is HttpGetPriceConfig {
  return priceConfig.type === 'http-get';
}

function isCompositePriceConfig(priceConfig: PriceConfig): priceConfig is CompositePriceConfig {
  return priceConfig.type === 'composite';
}

function isLbkexPriceConfig(priceConfig: PriceConfig): priceConfig is LbkexPriceConfig {
  return priceConfig.type === 'lbkex';
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

function parseDirection(direction: 'backward' | 'forward'): { isBackward: boolean } {
  let isBackward: boolean;
  if (direction === 'forward') {
    isBackward = false;
  } else if (direction === 'backward') {
    isBackward = true;
  } else {
    throw new Error('Unknown direction');
  }

  return { isBackward };
}

export function createPriceGetter(executor: Executor, priceConfig: PriceConfig): PriceGetter {
  if (isHttpGetPriceConfig(priceConfig)) {
    const { isBackward } = parseDirection(priceConfig.direction);
    const { url, path } = parseQuery(priceConfig.query);
    const priceMapper = createPriceMapper(path);

    return new HttpGetPriceGetter(executor, priceConfig.label, isBackward, url, priceMapper);
  } else if (isCompositePriceConfig(priceConfig)) {
    return new CompositePriceGetter(priceConfig.label, priceConfig.sources.map(x => createPriceGetter(executor, x)));
  } else if (isLbkexPriceConfig(priceConfig)) {
    return new LbkexPriceGetter(executor, priceConfig.label, priceConfig.priceChain.map(x => ({
      pair: x.pair,
      isBackward: parseDirection(x.direction).isBackward,
    })));
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

interface PriceChainItem {
  pair: string;
  isBackward: boolean;
}

class LbkexState {
  private readonly priceChain;

  private stepIndex = 0;
  private result = 1;

  constructor(priceChain: PriceChainItem[]) {
    this.priceChain = priceChain;
  }

  public performStep(responseStr?: string): string | undefined {
    if (this.stepIndex !== 0) {
      const previous = this.priceChain[this.stepIndex - 1];

      if (responseStr === undefined) {
        throw new Error(`Failed to read result for ${previous.pair}`);
      }
      const response = JSON.parse(responseStr);

      const price = response.tick.latest;

      if (this.priceChain[this.stepIndex - 1].isBackward) {
        this.result /= price;
      } else {
        this.result *= price;
      }
    }

    if (this.stepIndex === this.priceChain.length) {
      return undefined;
    } else {
      const data = JSON.stringify({
        'action': 'request',
        'request': 'tick',
        'pair': this.priceChain[this.stepIndex].pair,
      });
      this.stepIndex++;
      return data;
    }
  }

  public getResult(): number | undefined {
    if (this.stepIndex === 0 || this.stepIndex < this.priceChain.length) {
      return undefined;
    } else {
      return this.result;
    }
  }
}

function createLbkexPriceGetterPromise(logger: Logger, priceChain: PriceChainItem[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const state = new LbkexState(priceChain);
    let firstError: unknown = undefined;
    const ws = new WebSocket('wss://www.lbkex.net/ws/V2/');

    function handleError(error: unknown) {
      if (firstError === undefined) {
        firstError = error;
      } else {
        logger.error(error, 'Secondary error has occurred');
      }
    }

    function performStep(response?: string) {
      try {
        const request = state.performStep(response);

        if (request === undefined) {
          ws.close();
        } else {
          ws.send(request);
        }
      } catch (error) {
        handleError(error);
        ws.close();
      }
    }

    ws.on('error', function(error) {
      handleError(error);
      ws.close();
    });
    ws.on('open', performStep);
    ws.on('message', performStep);
    ws.on('close', function() {
      if (firstError !== undefined) {
        reject(firstError);
      } else {
        const result = state.getResult();

        if (result === undefined) {
          reject(new Error('Result is not ready'));
        } else {
          resolve(result);
        }
      }
    });
  });
}

class LbkexPriceGetter implements PriceGetter {
  private readonly executor: Executor;
  private readonly label: string;
  private readonly priceChain: PriceChainItem[];

  public constructor(executor: Executor, label: string, priceChain: PriceChainItem[]) {
    this.executor = executor;
    this.label = label;
    this.priceChain = priceChain;
  }

  public async getPrice(logger: Logger): Promise<number> {
    return this.executor(() => createLbkexPriceGetterPromise(logger, this.priceChain));
  }
}