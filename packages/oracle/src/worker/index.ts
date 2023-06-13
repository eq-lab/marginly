import {
  CancellationTokenSource,
  Worker,
} from '@marginly/common/lifecycle';
import { Logger } from '@marginly/common/logger';
import { Executor, sleep } from '@marginly/common/execution';
import { StrictConfig, StrictTokenConfig, UniswapV3PoolMockConfig } from '../config';
import {
  priceToPriceFp18,
  priceToSqrtPriceX96,


} from '@marginly/common/math';
import { createPriceGetter, PriceGetter } from '@marginly/common/price';
import * as ethers from 'ethers';
import { ContractDescription, EthAddress } from '@marginly/common';
import { using } from '@marginly/common/resource';

function readUniswapMockContract(name: string): ContractDescription {
  return require(`@marginly/contracts-uniswap-mock/artifacts/contracts/${name}.sol/${name}.json`);
}

function readOpenzeppelinContract(name: string): ContractDescription {
  return require(`@openzeppelin/contracts/build/contracts/${name}.json`);
}

type Token = StrictTokenConfig & {
  contract: ethers.Contract,
  symbol: string,
  decimals: number
};

type PoolMock = UniswapV3PoolMockConfig & {
  contract: ethers.Contract,
  token0Address: EthAddress,
  token1Address: EthAddress,
}

export class OracleWorker implements Worker {
  private readonly cancellationTokenSource: CancellationTokenSource;

  private readonly config;
  private readonly logger;
  private readonly executor;

  private state?: {
    priceCache: Map<string, {updatedAt: bigint, value: number}>;
    priceGetters: Map<string, PriceGetter>;
    lastJobStartTimes: Map<string, bigint>;
    poolMocks: Map<string, PoolMock>;
    tokens: Map<string, Token>;
  };

  public constructor(
    config: StrictConfig,
    logger: Logger,
    executor: Executor,
  ) {
    this.cancellationTokenSource = new CancellationTokenSource();

    this.config = config;
    this.logger = logger;
    this.executor = executor;
  }

  public requestStop(): void {
    this.logger.info('Stop requested');
    this.cancellationTokenSource.cancel();
  }

  private getNowMs(): bigint {
    return process.hrtime.bigint() / 1_000_000n;
  }

  private async getPrice(logger: Logger, priceId: string): Promise<number> {
    const priceCacheTimeMs = BigInt(this.config.oracleWorker.priceCachePeriodMs);

    if (this.state === undefined) {
      throw new Error('Worker is not started');
    }

    const cachedPrice = this.state.priceCache.get(priceId);
    if (cachedPrice === undefined || cachedPrice.updatedAt + priceCacheTimeMs < this.getNowMs()) {
      const priceGetter = this.state.priceGetters.get(priceId);
      if (priceGetter === undefined) {
        throw new Error(`Unknown price id ${priceId}`);
      }
      logger.info(`Load fresh price for ${priceId}`);
      const price = await priceGetter.getPrice(logger);

      this.state.priceCache.set(priceId, {updatedAt: this.getNowMs(), value: price});

      return price;
    } else {
      return cachedPrice.value;
    }
  }

  private findTokenByAddress(address: EthAddress): Token {
    if (this.state === undefined) {
      throw new Error('Worker is not started');
    }
    for (const token of this.state.tokens.values()) {
      if (token.address.compare(address) === 0) {
        return token;
      }
    }
    throw new Error(`Token with address ${address} not found`);
  }

  private async processTick(logger: Logger, poolMockId: string, periodMs: bigint): Promise<void> {
    if (this.state === undefined) {
      throw new Error('Worker is not started');
    }
    const lastStartTime = this.state.lastJobStartTimes.get(poolMockId);

    const startTime = this.getNowMs();

    if (lastStartTime === undefined || lastStartTime + periodMs < startTime) {
      logger.info(`Update price started`);
      const poolMock = this.state.poolMocks.get(poolMockId);
      if (poolMock === undefined) {
        throw new Error(`Pool mock with id ${poolMockId} is not found`);
      }
      const price = await this.getPrice(logger, poolMock.priceId);

      const priceBaseToken = this.state.tokens.get(poolMock.priceBaseTokenId);

      if (priceBaseToken === undefined) {
        throw new Error(`Price base token ${poolMock.priceBaseTokenId} not found`);
      }

      const token0 = this.findTokenByAddress(poolMock.token0Address);
      const token1 = this.findTokenByAddress(poolMock.token1Address);

      let token0Price: number;
      if (token0.id === priceBaseToken.id) {
        token0Price = price;
      } else if (token1.id === priceBaseToken.id) {
        token0Price = 1 / price;
      } else {
        throw new Error(`Price base token ${priceBaseToken.id} is neither token0 nor token1`);
      }

      logger.info(`For pool ${poolMock.id} token0 is ${token0.id} (${token0.decimals}), token1 is ${token1.id}, (${token1.decimals})`);
      const priceFp18 = priceToPriceFp18(token0Price, token0.decimals, token1.decimals);
      const sqrtPriceX96 = priceToSqrtPriceX96(token0Price, token0.decimals, token1.decimals);
      logger.info(`About to set ${poolMock.priceId} price: ${token0Price}, fp18: ${priceFp18}, sqrtPriceX96: ${sqrtPriceX96} to ${poolMock.id} pool mock`);

      await poolMock.contract.setPrice(priceFp18, sqrtPriceX96);

      this.state.lastJobStartTimes.set(poolMockId, startTime);
    }
  }

  public async run(): Promise<void> {
    const cancellationToken = this.cancellationTokenSource.getToken();

    const provider = new ethers.providers.JsonRpcProvider(this.config.ethereum.nodeUrl);

    const oracleSigner = new ethers.Wallet(this.config.ethereum.oraclePrivateKey).connect(provider);

    const tokenContractDescription = readOpenzeppelinContract('IERC20Metadata');

    const tokens = new Map<string, Token>();

    for (const tokenConfig of this.config.tokens) {
      const contract = new ethers.Contract(tokenConfig.address.toString(), tokenContractDescription.abi, provider);
      const symbol = await contract.symbol();
      const decimals = await contract.decimals();
      tokens.set(tokenConfig.id, { ...tokenConfig, contract, symbol, decimals });
    }

    const priceGetters = new Map<string, PriceGetter>();

    for (const priceConfig of this.config.prices) {
      priceGetters.set(priceConfig.id, createPriceGetter(this.executor, priceConfig));
    }

    const uniswapV3PoolMockContractDescription = readUniswapMockContract('UniswapV3PoolMock');

    const poolMocks = new Map<string, PoolMock>();

    for (const poolMockConfig of this.config.uniswapV3PoolMocks) {
      const contract = new ethers.Contract(poolMockConfig.address, uniswapV3PoolMockContractDescription.abi, oracleSigner);
      const token0 = await contract.token0();
      const token1 = await contract.token1();
      poolMocks.set(poolMockConfig.id, {
        ...poolMockConfig,
        contract,
        token0Address: EthAddress.parse(token0),
        token1Address: EthAddress.parse(token1)
      });
    }

    this.state = {
      priceGetters,
      priceCache: new Map<string, {updatedAt: bigint, value: number}>(),
      lastJobStartTimes: new Map<string, bigint>(),
      poolMocks,
      tokens
    };

    this.logger.info('Start oracle worker');
    while (true) {
      if (cancellationToken.isCancelled()) {
        this.logger.info('Stopping oracle worker');
        break;
      }

      for (const { poolMockId, periodMs } of this.config.oracleWorker.updatePriceJobs) {
        await using(this.logger.scope(poolMockId), async (logger) => {
          await this.processTick(logger, poolMockId, BigInt(periodMs));
        });
      }

      await sleep(
        this.config.oracleWorker.tickMs,
      );
    }
  }
}
