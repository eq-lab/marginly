import { CancellationTokenSource, Worker } from '@marginly/common/lifecycle';
import { Logger } from '@marginly/common/logger';
import { Executor } from '@marginly/common/execution';
import { StrictConfig, StrictOracleWorkerConfig, StrictTokenConfig, UniswapV3PoolMockConfig } from '../config';
import { priceToPriceFp18, priceToPriceFp27, priceToSqrtPriceX96 } from '@marginly/common/math';
import * as ethers from 'ethers';
import { ContractDescription, EthAddress, sleep } from '@marginly/common';
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
  priceDenominator: BigNumber;
};

export class OracleWorker implements Worker {
  private readonly cancellationTokenSource: CancellationTokenSource;

  private readonly config;
  private readonly logger;
  private readonly executor;
  private readonly pricesRepository: PricesRepository;
  private readonly workerId;
  private readonly transientState;

  private state?: {
    workerConfig: StrictOracleWorkerConfig;
    lastJobStartTimes: Map<string, bigint>;
    poolMocks: Map<string, PoolMock>;
    tokens: Map<string, Token>;
    chainId: number;
  };

  public constructor(
    config: StrictConfig,
    logger: Logger,
    executor: Executor,
    pricesRepository: PricesRepository,
    workerId: string,
    transientState: string[] = []
  ) {
    this.cancellationTokenSource = new CancellationTokenSource();

    this.config = config;
    this.logger = logger;
    this.executor = executor;
    this.pricesRepository = pricesRepository;
    this.workerId = workerId;
    this.transientState = transientState;
  }

  public requestStop(): void {
    using(this.logger.scope(this.workerId), (logger) => {
      logger.info('Stop requested');
      this.cancellationTokenSource.cancel();
    });
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

  private isZkSyncEra(): boolean {
    if (this.state === undefined) {
      throw new Error('Worker is not started');
    }
    const zkSyncEraTestnetChainId = 280;
    const zkSyncEraMainnetChainId = 324;

    return this.state.chainId === zkSyncEraTestnetChainId || this.state.chainId === zkSyncEraMainnetChainId;
  }

  private isErrorMessageContains(error: unknown, text: string): boolean {
    const slightlyTypedError = error as { message?: string };
    if (typeof slightlyTypedError?.message === 'string') {
      return slightlyTypedError.message.match(new RegExp(text, 'i')) !== null;
    }
    return false;
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
      const priceDenominator = poolMock.priceDenominator;

      let token0Price: number;
      if (token0.id === priceBaseToken.id) {
        token0Price = price;
      } else if (token1.id === priceBaseToken.id) {
        token0Price = 1 / price;
      } else {
        throw new Error(`Price base token ${priceBaseToken.id} is neither token0 nor token1`);
      }

      logger.debug(
        `For pool ${poolMock.id} token0 is ${token0.id} (${token0.decimals}), token1 is ${token1.id}, (${token1.decimals})`
      );
      const sqrtPriceX96 = priceToSqrtPriceX96(token0Price, token0.decimals, token1.decimals);

      const priceDenominator27 = BigNumber.from(10).pow(27);
      const priceDenominator18 = BigNumber.from(10).pow(18);
      const priceDenominatorPepe = BigNumber.from(2).pow(192);

      let priceFp;
      let fpNumber;
      if (priceDenominator.eq(priceDenominator27)) {
        priceFp = priceToPriceFp27(token0Price, token0.decimals, token1.decimals);
        fpNumber = 27;
      } else if (priceDenominator.eq(priceDenominator18) || priceDenominator.eq(priceDenominatorPepe)) {
        // to support old uniswap mocks and support pepe uniswap mock with priceDenominatorPepe
        priceFp = priceToPriceFp18(token0Price, token0.decimals, token1.decimals);
        fpNumber = 18;
      } else {
        throw new Error(
          `Unknown PRICE_DENOMINATOR: ${priceDenominator} in UniswapV3PoolMock contract:${poolMock.address}`
        );
      }

      logger.info(
        `About to set ${poolMock.priceId} price: ${token0Price}, fp${fpNumber}: ${priceFp}, sqrtPriceX96: ${sqrtPriceX96} to ${poolMock.id} pool mock`
      );

      let tx;
      try {
        tx = await poolMock.contract.setPrice(priceFp, sqrtPriceX96);
      } catch (error) {
        const errorRecord = error as Record<string, unknown>;

        if (!poolMock.validated) {
          throw error;
        } else {
          if (errorRecord?.code === ethers.utils.Logger.errors.UNPREDICTABLE_GAS_LIMIT) {
            logger.warn(error, 'Unable to set price: unpredictable gas limit');
          } else if (errorRecord?.code === ethers.utils.Logger.errors.INSUFFICIENT_FUNDS) {
            logger.warn(error, 'Unable to set price: insufficient funds');
          } else if (this.isZkSyncEra() && this.isErrorMessageContains(error, 'not enough balance')) {
            logger.warn(error, 'Unable to set price: not enough balance');
          } else {
            throw error;
          }
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

        const actualPriceFp = event.args?.price;
        if (actualPriceFp === undefined) {
          throw new Error('SetPrice field actualPrice is not found');
        }
        if (!BigNumber.from(priceFp).eq(actualPriceFp)) {
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
    await using(this.logger.scope(this.workerId), async (logger) => {
      logger.info('Starting oracle worker');

      const cancellationToken = this.cancellationTokenSource.getToken();

      const workerConfig = this.config.oracleWorkers.find((x) => x.id === this.workerId);

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

      let alreadyValidatedPoolIds: Set<string>;
      if (workerConfig.disableMockValidation) {
        logger.info(`Mock validation is disabled so ignoring transient state if any`);
        alreadyValidatedPoolIds = new Set(workerConfig.uniswapV3PoolMocks.map((x) => x.id));
      } else {
        if (this.transientState.length > 0) {
          logger.info(`Assuming following mocks are already validated: ${this.transientState.join(', ')}`);
        }
        alreadyValidatedPoolIds = new Set(this.transientState);
      }

      for (const poolMockConfig of workerConfig.uniswapV3PoolMocks) {
        const contract = new ethers.Contract(
          poolMockConfig.address,
          uniswapV3PoolMockContractDescription.abi,
          oracleSigner
        );
        const token0 = await contract.token0();
        const token1 = await contract.token1();
        const priceDenominator = BigNumber.from(await contract.PRICE_DENOMINATOR());
        poolMocks.set(poolMockConfig.id, {
          ...poolMockConfig,
          validated: alreadyValidatedPoolIds.has(poolMockConfig.id),
          contract,
          token0Address: EthAddress.parse(token0),
          token1Address: EthAddress.parse(token1),
          priceDenominator: priceDenominator,
        });
      }

      const { chainId } = await provider.getNetwork();

      this.state = {
        workerConfig,
        lastJobStartTimes: new Map<string, bigint>(),
        poolMocks,
        tokens,
        chainId,
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

        await sleep(workerConfig.tickMs);
      }
    });
  }

  public getTransientState(): string[] {
    const validatedMockIds: string[] = [];
    if (this.state !== undefined) {
      for (const mock of this.state.poolMocks.values()) {
        if (mock.validated) {
          validatedMockIds.push(mock.id);
        }
      }
    }
    return validatedMockIds;
  }
}
