import { createPriceGetter, PriceGetter, RootPriceConfig } from '@marginly/common/price';
import { Mutex } from 'async-mutex';
import { Executor } from '@marginly/common/execution';
import { Logger } from '@marginly/common/dist/logger';
import { StrictConfig } from '../config';

export class PricesRepository {
  private readonly mutex = new Mutex();
  private readonly priceGetters = new Map<string, PriceGetter>();
  private readonly priceCache = new Map<string, {updatedAt: bigint, value: number}>();

  private readonly config: StrictConfig;
  private readonly executor: Executor;

  public constructor(config: StrictConfig, executor: Executor) {
    this.config = config;
    this.executor = executor;

    for (const priceConfig of this.config.pricesRepository.prices) {
      this.priceGetters.set(priceConfig.id, createPriceGetter(this.executor, priceConfig));
    }
  }

  private getNowMs(): bigint {
    return process.hrtime.bigint() / 1_000_000n;
  }

  public async getPrice(logger: Logger, priceId: string): Promise<number> {
    return this.mutex.runExclusive(async () => {
        const priceCacheTimeMs = BigInt(this.config.pricesRepository.priceCachePeriodMs);

        const cachedPrice = this.priceCache.get(priceId);
        if (cachedPrice === undefined || cachedPrice.updatedAt + priceCacheTimeMs < this.getNowMs()) {
          const priceGetter = this.priceGetters.get(priceId);
          if (priceGetter === undefined) {
            throw new Error(`Unknown price id ${priceId}`);
          }
          logger.info(`Load fresh price for ${priceId}`);
          const price = await priceGetter.getPrice(logger);

          this.priceCache.set(priceId, { updatedAt: this.getNowMs(), value: price });

          return price;
        } else {
          return cachedPrice.value;
        }
      }
    );
  }
}