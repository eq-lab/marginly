import {
  CancellationTokenSource,
  Worker,
} from '@marginly/common/lifecycle';
import { Logger } from '@marginly/common/logger';
import { Executor, sleep } from '@marginly/common/execution';
import { StrictConfig, StrictOracleWorkerConfig, StrictTokenConfig, UniswapV3PoolMockConfig } from '../config';
import {
  priceToPriceFp18,
  priceToSqrtPriceX96,


} from '@marginly/common/math';
import * as ethers from 'ethers';
import { ContractDescription, EthAddress } from '@marginly/common';
import { using } from '@marginly/common/resource';
import { PricesRepository } from '../repository/prices';
import { BigNumber, Event } from 'ethers';

function readUniswapMockContract(name: string): ContractDescription {
  return require(`@marginly/contracts-uniswap-mock/artifacts/contracts/${name}.sol/${name}.json`);
}

function readOpenzeppelinContract(name: string): ContractDescription {
  return require(`@openzeppelin/contracts/build/contracts/${name}.json`);
}

type Token = StrictTokenConfig & {
  contract: ethers.Contract;
  symbol: string;
  decimals: number;
};

type PoolMock = UniswapV3PoolMockConfig & {
  validated: boolean;
  contract: ethers.Contract;
  token0Address: EthAddress;
  token1Address: EthAddress;
}

export class OracleWorker implements Worker {
  private readonly cancellationTokenSource: CancellationTokenSource;

  private readonly config;
  private readonly logger;
  private readonly executor;
  private readonly pricesRepository: PricesRepository;
  private readonly workerId;

  private state?: {
    workerConfig: StrictOracleWorkerConfig,
    lastJobStartTimes: Map<string, bigint>;
    poolMocks: Map<string, PoolMock>;
    tokens: Map<string, Token>;
  };

  public constructor(
    config: StrictConfig,
    logger: Logger,
    executor: Executor,
    pricesRepository: PricesRepository,
    workerId: string) {
    this.cancellationTokenSource = new CancellationTokenSource();

    this.config = config;
    this.logger = logger;
    this.executor = executor;
    this.pricesRepository = pricesRepository;
    this.workerId = workerId;
  }

  public requestStop(): void {
    this.logger.info('Stop requested');
    this.cancellationTokenSource.cancel();
  }

  private getNowMs(): bigint {
    return process.hrtime.bigint() / 1_000_000n;
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
      const price = await this.pricesRepository.getPrice(logger, poolMock.priceId);

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

      let tx;
      try {
        tx = await poolMock.contract.setPrice(priceFp18, sqrtPriceX96);
      } catch (error) {
        if (poolMock.validated && (error as Record<string, unknown>)?.code === ethers.utils.Logger.errors.UNPREDICTABLE_GAS_LIMIT) {
          logger.warn('Unable to set price: unpredictable gas limit');
        } else {
          throw error;
        }
      }

      if (!poolMock.validated) {
        logger.info('Validating setPrice call result');

        if (tx === undefined) {
          throw new Error('Invalid state: tx can not be undefined before successful mock validation');
        }
        const setPriceEvents: Event[] = (await tx.wait()).events.filter((x: Event) => x.event === 'SetPrice');

        if (setPriceEvents.length === 0) {
          throw new Error('SetPrice event is not found');
        }

        if (setPriceEvents.length > 1) {
          throw new Error('Found multiple SetPrice events');
        }

        const event = setPriceEvents[0];

        const actualPriceFp18 = event.args?.price;
        if (actualPriceFp18 === undefined) {
          throw new Error('SetPrice field actualPrice is not found');
        }
        if (!BigNumber.from(priceFp18).eq(actualPriceFp18)) {
          throw new Error('Set price differs from actual');
        }

        const actualSqrtPriceX96 = event.args?.sqrtPriceX96;
        if (actualSqrtPriceX96 === undefined) {
          throw new Error('SetPrice field sqrtPriceX96 is not found');
        }
        if (!BigNumber.from(sqrtPriceX96).eq(actualSqrtPriceX96)) {
          throw new Error('Set sqrtPriceX96 differs from actual');
        }

        poolMock.validated = true;
      }

      this.state.lastJobStartTimes.set(poolMockId, startTime);
    }
  }

  public async run(): Promise<void> {
    await using(this.logger.scope(this.workerId), async logger => {
      logger.info('Starting oracle worker');

      const cancellationToken = this.cancellationTokenSource.getToken();

      const workerConfig = this.config.oracleWorkers.find(x => x.id === this.workerId);

      if (workerConfig === undefined) {
        throw new Error(`Worker with id ${this.workerId} not found`);
      }

      const provider = new ethers.providers.JsonRpcProvider(workerConfig.ethereum.nodeUrl);

      const oracleSigner = new ethers.Wallet(workerConfig.ethereum.oraclePrivateKey).connect(provider);

      const tokenContractDescription = readOpenzeppelinContract('IERC20Metadata');

      const tokens = new Map<string, Token>();

      for (const tokenConfig of workerConfig.tokens) {
        const contract = new ethers.Contract(tokenConfig.address.toString(), tokenContractDescription.abi, provider);
        const symbol = await contract.symbol();
        const decimals = await contract.decimals();
        tokens.set(tokenConfig.id, { ...tokenConfig, contract, symbol, decimals });
      }

      const uniswapV3PoolMockContractDescription = readUniswapMockContract('UniswapV3PoolMock');

      const poolMocks = new Map<string, PoolMock>();

      for (const poolMockConfig of workerConfig.uniswapV3PoolMocks) {
        const contract = new ethers.Contract(poolMockConfig.address, uniswapV3PoolMockContractDescription.abi, oracleSigner);
        const token0 = await contract.token0();
        const token1 = await contract.token1();
        poolMocks.set(poolMockConfig.id, {
          ...poolMockConfig,
          validated: false,
          contract,
          token0Address: EthAddress.parse(token0),
          token1Address: EthAddress.parse(token1),
        });
      }

      this.state = {
        workerConfig,
        lastJobStartTimes: new Map<string, bigint>(),
        poolMocks,
        tokens,
      };

      logger.info('Oracle worker started');
      while (true) {
        if (cancellationToken.isCancelled()) {
          logger.info('Stopping oracle worker');
          break;
        }

        for (const { poolMockId, periodMs } of workerConfig.updatePriceJobs) {
          await using(logger.scope(poolMockId), async (logger) => {
            await this.processTick(logger, poolMockId, BigInt(periodMs));
          });
        }

        await sleep(
          workerConfig.tickMs,
        );
      }
    });
  }
}
