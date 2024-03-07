import { MarginlyConfigExistingToken, MarginlyConfigMintableToken, MarginlyConfigToken, TimeSpan } from '../common';
import { EthAddress, RationalNumber } from '@marginly/common';
import {
  EthConnectionConfig,
  isChainlinkOracleConfig,
  isDoublePairChainlinkOracleDeployConfig,
  isDoublePairPythOracleDeployConfig,
  isMarginlyDeployConfigExistingToken,
  isMarginlyDeployConfigMintableToken,
  isMarginlyDeployConfigSwapPoolRegistry,
  isMarginlyDeployConfigUniswapGenuine,
  isMarginlyDeployConfigUniswapMock,
  isPythOracleConfig,
  isSinglePairChainlinkOracleDeployConfig,
  isSinglePairPythOracleDeployConfig,
  isUniswapV3DoubleOracleConfig,
  isUniswapV3OracleConfig,
  MarginlyDeployConfig,
} from '../config';
import { adapterWriter, Logger } from '../logger';
import { createRootLogger, textFormatter } from '@marginly/logger';
import { timeoutRetry } from '@marginly/common/execution';
import { CriticalError } from '@marginly/common/error';
import { createPriceGetter } from '@marginly/common/price';
import * as ethers from 'ethers';
import { BigNumber } from 'ethers';

export interface MarginlyConfigUniswapPoolGenuine {
  type: 'genuine';
  id: string;
  tokenA: MarginlyConfigToken;
  tokenB: MarginlyConfigToken;
  fee: RationalNumber;
  allowCreate: boolean;
  assertAddress?: EthAddress;
}

export interface MarginlyConfigUniswapGenuine {
  type: 'genuine';
  factory: EthAddress;
  pools: MarginlyConfigUniswapPoolGenuine[];
}

export interface MarginlyConfigUniswapPoolMock {
  type: 'mock';
  id: string;
  tokenA: MarginlyConfigToken;
  tokenB: MarginlyConfigToken;
  fee: RationalNumber;
  tokenABalance?: RationalNumber;
  tokenBBalance?: RationalNumber;
  priceId: string;
  price: number;
  priceBaseTokenKey: 'tokenA' | 'tokenB';
}

export interface MarginlyConfigUniswapMock {
  type: 'mock';
  oracle: EthAddress;
  weth9Token: MarginlyConfigToken;
  priceLogSize: number;
  pools: MarginlyConfigUniswapPoolMock[];
}

export interface PriceProviderMock {
  answer: RationalNumber;
  decimals: number;
}

export interface PriceProvidersMockConfig {
  basePriceProviderMock?: PriceProviderMock;
  quotePriceProviderMock?: PriceProviderMock;
}

export interface PriceAdapterConfig {
  priceProvidersMock?: PriceProvidersMockConfig;
  basePriceProvider?: EthAddress;
  quotePriceProvider?: EthAddress;
}

export interface MarginlyConfigSwapPool {
  type: 'swapPool';
  id: string;
  priceAdapter: PriceAdapterConfig;
  tokenA: MarginlyConfigToken;
  tokenB: MarginlyConfigToken;
  fee: RationalNumber;
}

export interface MarginlyConfigSwapPoolRegistry {
  type: 'swapPoolRegistry';
  factory: EthAddress;
  pools: MarginlyConfigSwapPool[];
}

export type MarginlyConfigUniswap =
  | MarginlyConfigUniswapGenuine
  | MarginlyConfigUniswapMock
  | MarginlyConfigSwapPoolRegistry;

export function isMarginlyConfigUniswapGenuine(
  uniswap: MarginlyConfigUniswap
): uniswap is MarginlyConfigUniswapGenuine {
  return uniswap.type === 'genuine';
}

export function isMarginlyConfigUniswapMock(uniswap: MarginlyConfigUniswap): uniswap is MarginlyConfigUniswapMock {
  return uniswap.type === 'mock';
}

export function isMarginlyConfigSwapPoolRegistry(
  uniswap: MarginlyConfigUniswap
): uniswap is MarginlyConfigSwapPoolRegistry {
  return uniswap.type === 'swapPoolRegistry';
}

export type MarginlyConfigUniswapPool =
  | MarginlyConfigUniswapPoolGenuine
  | MarginlyConfigUniswapPoolMock
  | MarginlyConfigSwapPool;

export function isMarginlyConfigUniswapPoolGenuine(
  uniswapPool: MarginlyConfigUniswapPool
): uniswapPool is MarginlyConfigUniswapPoolGenuine {
  return uniswapPool.type === 'genuine';
}

export function isMarginlyConfigUniswapPoolMock(
  uniswapPool: MarginlyConfigUniswapPool
): uniswapPool is MarginlyConfigUniswapPoolMock {
  return uniswapPool.type === 'mock';
}

export function isMarginlyConfigSwapPool(uniswapPool: MarginlyConfigSwapPool): uniswapPool is MarginlyConfigSwapPool {
  return uniswapPool.type === 'swapPool';
}

export interface MarginlyFactoryConfig {
  feeHolder: EthAddress;
  techPositionOwner: EthAddress;
  weth9Token: MarginlyConfigToken;
  blastPointsAdmin: EthAddress;
}

export interface MarginlyPoolParams {
  interestRate: RationalNumber;
  fee: RationalNumber;
  maxLeverage: RationalNumber;
  swapFee: RationalNumber;
  mcSlippage: RationalNumber;
  positionMinAmount: RationalNumber;
  quoteLimit: RationalNumber;
}

export interface MarginlyConfigMarginlyPool {
  id: string;
  uniswapPool: MarginlyConfigUniswapPool;
  baseToken: MarginlyConfigToken;
  quoteToken: MarginlyConfigToken;
  params: MarginlyPoolParams;
  defaultSwapCallData: number;
  priceOracle: PriceOracleConfig;
}

export interface MarginlyAdapterParam {
  token0: MarginlyConfigToken;
  token1: MarginlyConfigToken;
  pool: EthAddress;
}

export interface MarginlyConfigAdapter {
  dexId: BigNumber;
  name: string;
  balancerVault?: EthAddress;
  marginlyAdapterParams: MarginlyAdapterParam[];
}

export interface MarginlyConfigMarginlyRouter {
  adapters: MarginlyConfigAdapter[];
}

export interface MarginlyConfigMarginlyKeeper {
  aavePoolAddressesProvider: {
    address?: EthAddress;
    allowCreateMock?: boolean;
  };
}

export type PriceOracleConfig =
  | UniswapV3TickOracleConfig
  | UniswapV3TickDoubleOracleConfig
  | ChainlinkOracleConfig
  | PythOracleConfig;

export interface UniswapV3TickOracleConfig {
  id: string;
  type: 'uniswapV3';
  settings: {
    quoteToken: MarginlyConfigToken;
    baseToken: MarginlyConfigToken;
    secondsAgo: TimeSpan;
    secondsAgoLiquidation: TimeSpan;
    uniswapFee: RationalNumber;
  }[];
}

export interface UniswapV3TickDoubleOracleConfig {
  id: string;
  type: 'uniswapV3Double';
  settings: {
    quoteToken: MarginlyConfigToken;
    baseToken: MarginlyConfigToken;
    intermediateToken: MarginlyConfigToken;
    secondsAgo: TimeSpan;
    secondsAgoLiquidation: TimeSpan;
    baseTokenPairFee: RationalNumber;
    quoteTokenPairFee: RationalNumber;
  }[];
}

export interface SinglePairChainlinkOracleConfig {
  type: 'single';
  quoteToken: MarginlyConfigToken;
  baseToken: MarginlyConfigToken;
  aggregatorV3: EthAddress;
}

export interface DoublePairChainlinkOracleConfig {
  type: 'double';
  quoteToken: MarginlyConfigToken;
  baseToken: MarginlyConfigToken;
  intermediateToken: MarginlyConfigToken;
  quoteAggregatorV3: EthAddress;
  baseAggregatorV3: EthAddress;
}

export type PairChainlinkOracleConfig = SinglePairChainlinkOracleConfig | DoublePairChainlinkOracleConfig;

export function isSinglePairChainlinkOracleConfig(
  config: PairChainlinkOracleConfig
): config is SinglePairChainlinkOracleConfig {
  return config.type === 'single';
}

export function isDoublePairChainlinkOracleConfig(
  config: PairChainlinkOracleConfig
): config is DoublePairChainlinkOracleConfig {
  return config.type === 'double';
}

export interface ChainlinkOracleConfig {
  id: string;
  type: 'chainlink';
  settings: PairChainlinkOracleConfig[];
}

export interface ChainlinkOracleConfig {
  type: 'chainlink';
  id: string;
  settings: PairChainlinkOracleConfig[];
}

export interface SinglePairPythOracleConfig {
  type: 'single';
  quoteToken: MarginlyConfigToken;
  baseToken: MarginlyConfigToken;
  pythPriceId: `0x${string}`;
}

export interface DoublePairPythOracleConfig {
  type: 'double';
  quoteToken: MarginlyConfigToken;
  baseToken: MarginlyConfigToken;
  intermediateToken: MarginlyConfigToken;
  basePythPriceId: `0x${string}`;
  quotePythPriceId: `0x${string}`;
}

export type PairPythOracleConfig = SinglePairPythOracleConfig | DoublePairPythOracleConfig;

export function isSinglePairPythOracleConfig(config: PairPythOracleConfig): config is SinglePairPythOracleConfig {
  return config.type === 'single';
}

export function isDoublePairPythOracleConfig(config: PairPythOracleConfig): config is DoublePairPythOracleConfig {
  return config.type === 'double';
}

export interface PythOracleConfig {
  id: string;
  type: 'pyth';
  pyth: EthAddress;
  settings: PairPythOracleConfig[];
}

export function isUniswapV3Oracle(config: PriceOracleConfig): config is UniswapV3TickOracleConfig {
  return config.type === 'uniswapV3';
}

export function isUniswapV3DoubleOracle(config: PriceOracleConfig): config is UniswapV3TickDoubleOracleConfig {
  return config.type === 'uniswapV3Double';
}

export function isChainlinkOracle(config: PriceOracleConfig): config is ChainlinkOracleConfig {
  return config.type === 'chainlink';
}

export function isPythOracle(config: PriceOracleConfig): config is PythOracleConfig {
  return config.type === 'pyth';
}

export class StrictMarginlyDeployConfig {
  public readonly connection: EthConnectionConfig;
  public readonly tokens: MarginlyConfigToken[];
  public readonly uniswap: MarginlyConfigUniswap;
  public readonly priceOracles: PriceOracleConfig[];
  public readonly marginlyFactory: MarginlyFactoryConfig;
  public readonly marginlyPools: MarginlyConfigMarginlyPool[];
  public readonly marginlyKeeper: MarginlyConfigMarginlyKeeper;
  public readonly marginlyRouter: MarginlyConfigMarginlyRouter;

  private constructor(
    connection: EthConnectionConfig,
    uniswap: MarginlyConfigUniswap,
    priceOracles: PriceOracleConfig[],
    marginlyFactory: MarginlyFactoryConfig,
    tokens: MarginlyConfigToken[],
    marginlyPools: MarginlyConfigMarginlyPool[],
    marginlyKeeper: MarginlyConfigMarginlyKeeper,
    marginlyRouter: MarginlyConfigMarginlyRouter
  ) {
    this.connection = connection;
    this.uniswap = uniswap;
    this.priceOracles = priceOracles;
    this.marginlyFactory = marginlyFactory;
    this.tokens = tokens;
    this.marginlyPools = marginlyPools;
    this.marginlyKeeper = marginlyKeeper;
    this.marginlyRouter = marginlyRouter;
  }

  public static async fromConfig(logger: Logger, config: MarginlyDeployConfig): Promise<StrictMarginlyDeployConfig> {
    const tokens = new Map<string, MarginlyConfigToken>();
    for (let i = 0; i < config.tokens.length; i++) {
      const rawToken = config.tokens[i];

      if (tokens.has(rawToken.id)) {
        throw new Error(`Duplicate token id ${rawToken.id} at index ${i}`);
      }

      if (isMarginlyDeployConfigExistingToken(rawToken)) {
        const token: MarginlyConfigExistingToken = {
          type: 'existing',
          id: rawToken.id,
          address: EthAddress.parse(rawToken.address),
          assertSymbol: rawToken.assertSymbol,
          assertDecimals: rawToken.assertDecimals,
        };
        tokens.set(rawToken.id, token);
      } else if (isMarginlyDeployConfigMintableToken(rawToken)) {
        const token: MarginlyConfigMintableToken = {
          type: 'mintable',
          id: rawToken.id,
          name: rawToken.name,
          symbol: rawToken.symbol,
          decimals: rawToken.decimals,
        };
        tokens.set(rawToken.id, token);
      }
    }

    const prices = new Map<string, number>();

    const priceLogger = createRootLogger('deploy', adapterWriter(logger, textFormatter));
    const executor = timeoutRetry({
      timeout: {
        errorClass: CriticalError,
      },
      retry: {
        errorClass: CriticalError,
        logger: priceLogger,
      },
    });

    for (const rawPrice of config.prices) {
      const priceGetter = createPriceGetter(executor, rawPrice);
      const price = await priceGetter.getPrice(priceLogger);
      prices.set(rawPrice.id, price);
      logger.log(`Price for ${rawPrice.id} is ${price}`);
    }

    let uniswap: MarginlyConfigUniswap;

    const uniswapPools = new Map<string, MarginlyConfigUniswapPool>();

    if (isMarginlyDeployConfigUniswapGenuine(config.uniswap)) {
      const genuinePools: MarginlyConfigUniswapPoolGenuine[] = [];
      for (let i = 0; i < config.uniswap.pools.length; i++) {
        const rawPool = config.uniswap.pools[i];

        if (uniswapPools.has(rawPool.id)) {
          throw new Error(`Duplicate uniswap pool id '${rawPool.id} at index ${i}`);
        }
        const tokenA = tokens.get(rawPool.tokenAId);
        if (tokenA === undefined) {
          throw new Error(`TokenA with id '${rawPool.tokenAId}' is not found for uniswap pool '${rawPool.id}'`);
        }
        const tokenB = tokens.get(rawPool.tokenBId);
        if (tokenB === undefined) {
          throw new Error(`TokenB with id '${rawPool.tokenBId}' is not found for uniswap pool '${rawPool.id}'`);
        }
        const fee = RationalNumber.parsePercent(rawPool.fee);
        const assertAddress = rawPool.assertAddress === undefined ? undefined : EthAddress.parse(rawPool.assertAddress);

        const pool: MarginlyConfigUniswapPoolGenuine = {
          type: 'genuine',
          id: rawPool.id,
          tokenA,
          tokenB,
          fee,
          allowCreate: rawPool.allowCreate,
          assertAddress: assertAddress,
        };
        uniswapPools.set(rawPool.id, pool);
        genuinePools.push(pool);
      }
      uniswap = {
        type: 'genuine',
        factory: EthAddress.parse(config.uniswap.factory),
        pools: genuinePools,
      };
    } else if (isMarginlyDeployConfigUniswapMock(config.uniswap)) {
      const mockPools: MarginlyConfigUniswapPoolMock[] = [];
      for (let i = 0; i < config.uniswap.pools.length; i++) {
        const rawPool = config.uniswap.pools[i];

        if (uniswapPools.has(rawPool.id)) {
          throw new Error(`Duplicate uniswap pool id '${rawPool.id} at index ${i}`);
        }
        const tokenA = tokens.get(rawPool.tokenAId);
        if (tokenA === undefined) {
          throw new Error(`TokenA with id '${rawPool.tokenAId}' is not found for uniswap pool '${rawPool.id}'`);
        }
        const tokenB = tokens.get(rawPool.tokenBId);
        if (tokenB === undefined) {
          throw new Error(`TokenB with id '${rawPool.tokenBId}' is not found for uniswap pool '${rawPool.id}'`);
        }
        const fee = RationalNumber.parsePercent(rawPool.fee);

        const price = prices.get(rawPool.priceId);

        if (price === undefined) {
          throw new Error(`Price with id ${rawPool.priceId} not found`);
        }

        const priceBaseToken = tokens.get(rawPool.priceBaseTokenId);

        if (priceBaseToken === undefined) {
          throw new Error(`Price base token with id ${rawPool.priceBaseTokenId} not found`);
        }

        let priceBaseTokenKey: 'tokenA' | 'tokenB';

        if (priceBaseToken.id === tokenA.id) {
          priceBaseTokenKey = 'tokenA';
        } else if (priceBaseToken.id === tokenB.id) {
          priceBaseTokenKey = 'tokenB';
        } else {
          throw new Error('Price base token must be either tokenA or tokenB');
        }

        const pool: MarginlyConfigUniswapPoolMock = {
          type: 'mock',
          id: rawPool.id,
          tokenA,
          tokenB,
          fee,
          tokenABalance: rawPool.tokenABalance === undefined ? undefined : RationalNumber.parse(rawPool.tokenABalance),
          tokenBBalance: rawPool.tokenBBalance === undefined ? undefined : RationalNumber.parse(rawPool.tokenBBalance),
          priceId: rawPool.priceId,
          price,
          priceBaseTokenKey,
        };
        uniswapPools.set(rawPool.id, pool);
        mockPools.push(pool);
      }

      const weth9Token = tokens.get(config.uniswap.weth9TokenId);

      if (weth9Token === undefined) {
        throw new Error(`WETH9 token with id ${config.uniswap.weth9TokenId} not found`);
      }

      if (config.uniswap.priceLogSize < 1 || config.uniswap.priceLogSize > 65535) {
        throw new Error('Invalid price log size');
      }

      uniswap = {
        type: 'mock',
        oracle: EthAddress.parse(config.uniswap.oracle),
        weth9Token,
        priceLogSize: config.uniswap.priceLogSize,
        pools: mockPools,
      };
    } else if (isMarginlyDeployConfigSwapPoolRegistry(config.uniswap)) {
      const swapPools: MarginlyConfigSwapPool[] = [];
      for (let i = 0; i < config.uniswap.pools.length; i++) {
        const rawPool = config.uniswap.pools[i];

        if (uniswapPools.has(rawPool.id)) {
          throw new Error(`Duplicate uniswap pool id '${rawPool.id} at index ${i}`);
        }

        const tokenA = tokens.get(rawPool.tokenAId);
        if (tokenA === undefined) {
          throw new Error(`TokenA with id '${rawPool.tokenAId}' is not found for uniswap pool '${rawPool.id}'`);
        }
        const tokenB = tokens.get(rawPool.tokenBId);
        if (tokenB === undefined) {
          throw new Error(`TokenB with id '${rawPool.tokenBId}' is not found for uniswap pool '${rawPool.id}'`);
        }
        const fee = RationalNumber.parsePercent(rawPool.fee);

        let basePriceProviderMock, quotePriceProviderMock, priceProvidersMock;
        if (rawPool.priceProvidersMock !== undefined) {
          if (rawPool.priceProvidersMock.basePriceProviderMock !== undefined) {
            basePriceProviderMock = {
              answer: RationalNumber.parse(rawPool.priceProvidersMock.basePriceProviderMock.answer),
              decimals: Number(rawPool.priceProvidersMock.basePriceProviderMock.decimals),
            };
          }
          if (rawPool.priceProvidersMock.quotePriceProviderMock !== undefined) {
            quotePriceProviderMock = {
              answer: RationalNumber.parse(rawPool.priceProvidersMock.quotePriceProviderMock.answer),
              decimals: Number(rawPool.priceProvidersMock.quotePriceProviderMock.decimals),
            };
          }
          priceProvidersMock = { basePriceProviderMock, quotePriceProviderMock };
        }

        let basePriceProvider, quotePriceProvider;
        if (rawPool.priceAdapter.basePriceProvider !== undefined) {
          basePriceProvider = EthAddress.parse(rawPool.priceAdapter.basePriceProvider);
        }

        if (quotePriceProviderMock === undefined) {
          quotePriceProvider = EthAddress.parse(
            rawPool.priceAdapter.quotePriceProvider ?? '0x0000000000000000000000000000000000000000'
          );
        } else if (quotePriceProviderMock !== undefined && rawPool.priceAdapter.quotePriceProvider !== undefined) {
          throw new Error(
            `Both quote PriceProvider and PriceProviderMock for uniswap pool with id ${rawPool.id} is found`
          );
        }

        if (basePriceProviderMock === undefined && basePriceProvider === undefined) {
          throw new Error(
            `Not base PriceProvider nor PriceProviderMock for uniswap pool with id ${rawPool.id} is not found`
          );
        }

        if (basePriceProviderMock !== undefined && basePriceProvider !== undefined) {
          throw new Error(
            `Both base PriceProvider and PriceProviderMock for uniswap pool with id ${rawPool.id} is found`
          );
        }

        const priceProvider: PriceAdapterConfig = {
          priceProvidersMock,
          basePriceProvider,
          quotePriceProvider,
        };

        const pool: MarginlyConfigSwapPool = {
          type: 'swapPool',
          id: rawPool.id,
          tokenA,
          tokenB,
          fee,
          priceAdapter: priceProvider,
        };
        uniswapPools.set(rawPool.id, pool);
        swapPools.push(pool);
      }
      uniswap = {
        type: 'swapPoolRegistry',
        factory: EthAddress.parse(config.uniswap.factory),
        pools: swapPools,
      };
    } else {
      throw new Error('Unknown uniswap type');
    }

    const priceOracles = this.createPriceOracleConfigs(config, tokens);

    const marginlyPools: MarginlyConfigMarginlyPool[] = [];
    for (let i = 0; i < config.marginlyPools.length; i++) {
      const rawPool = config.marginlyPools[i];

      const uniswapPool = uniswapPools.get(rawPool.uniswapPoolId);
      if (uniswapPool === undefined) {
        throw new Error(`Can not find uniswap pool '${rawPool.uniswapPoolId}' for marginly pool with index ${i}`);
      }

      const baseToken = tokens.get(rawPool.baseTokenId);
      if (baseToken === undefined) {
        throw new Error(`Base token with id '${rawPool.baseTokenId}' is not found for marginly pool '${rawPool.id}'`);
      }

      if (baseToken.id !== uniswapPool.tokenA.id && baseToken.id !== uniswapPool.tokenB.id) {
        throw new Error(
          `Base token with id '${baseToken.id}' of marginly pool '${rawPool.id}' not found in uniswap pool '${uniswapPool.id}'`
        );
      }

      const quoteToken = uniswapPool.tokenA.id === baseToken.id ? uniswapPool.tokenB : uniswapPool.tokenA;

      const params: MarginlyPoolParams = {
        interestRate: RationalNumber.parsePercent(rawPool.params.interestRate),
        fee: RationalNumber.parsePercent(rawPool.params.fee),
        maxLeverage: RationalNumber.parse(rawPool.params.maxLeverage),
        swapFee: RationalNumber.parsePercent(rawPool.params.swapFee),
        mcSlippage: RationalNumber.parsePercent(rawPool.params.mcSlippage),
        positionMinAmount: RationalNumber.parse(rawPool.params.positionMinAmount),
        quoteLimit: RationalNumber.parse(rawPool.params.quoteLimit),
      };

      const priceOracle = priceOracles.get(rawPool.priceOracleId);
      if (!priceOracle) {
        throw new Error(`Price oracle with id ${rawPool.priceOracleId} not found`);
      }

      marginlyPools.push({
        id: rawPool.id,
        uniswapPool,
        baseToken,
        quoteToken,
        params,
        defaultSwapCallData: rawPool.defaultSwapCallData,
        priceOracle,
      });
    }

    if (
      (config.marginlyKeeper.aavePoolAddressesProvider.address &&
        config.marginlyKeeper.aavePoolAddressesProvider.allowCreateMock) ||
      (!config.marginlyKeeper.aavePoolAddressesProvider.address &&
        !config.marginlyKeeper.aavePoolAddressesProvider.allowCreateMock)
    ) {
      throw new Error(
        `Config error. You should either provide address of aavePoolAddressesProvider or set flag allowCreateMock`
      );
    }

    const adapters: MarginlyConfigAdapter[] = [];

    for (const adapter of config.adapters) {
      const adapterParams: MarginlyAdapterParam[] = [];
      for (const pool of adapter.pools) {
        const poolAddress = EthAddress.parse(pool.poolAddress);
        const token0 = tokens.get(pool.tokenAId);
        if (token0 === undefined) {
          throw new Error(`Can not find token0 '${pool.tokenAId}' for adapter with dexId ${adapter.dexId}`);
        }
        const token1 = tokens.get(pool.tokenBId);
        if (token1 === undefined) {
          throw new Error(`Can not find token1 '${pool.tokenBId}' for adapter with dexId ${adapter.dexId}`);
        }
        adapterParams.push({
          token0: token0,
          token1: token1,
          pool: poolAddress,
        });
      }

      adapters.push({
        dexId: BigNumber.from(adapter.dexId),
        balancerVault: adapter.balancerVault ? EthAddress.parse(adapter.balancerVault) : undefined,
        name: adapter.adapterName,
        marginlyAdapterParams: adapterParams,
      });
    }

    const marginlyRouter: MarginlyConfigMarginlyRouter = { adapters };

    const marginlyKeeper: MarginlyConfigMarginlyKeeper = {
      aavePoolAddressesProvider: {
        address: config.marginlyKeeper.aavePoolAddressesProvider.address
          ? EthAddress.parse(config.marginlyKeeper.aavePoolAddressesProvider.address)
          : undefined,
        allowCreateMock: config.marginlyKeeper.aavePoolAddressesProvider.allowCreateMock,
      },
    };

    const wethToken = tokens.get(config.marginlyFactory.wethTokenId);
    if (wethToken === undefined) {
      throw new Error(`Can not find WETH token by tokenId'${config.marginlyFactory.wethTokenId} for marginly factory`);
    }

    return new StrictMarginlyDeployConfig(
      config.connection,
      uniswap,
      Array.from(priceOracles.values()),
      {
        feeHolder: EthAddress.parse(config.marginlyFactory.feeHolder),
        techPositionOwner: EthAddress.parse(config.marginlyFactory.techPositionOwner),
        weth9Token: wethToken,
        blastPointsAdmin: EthAddress.parse(config.marginlyFactory.blastPointsAdmin),
      },
      Array.from(tokens.values()),
      marginlyPools,
      marginlyKeeper,
      marginlyRouter
    );
  }

  private static createPriceOracleConfigs(
    config: MarginlyDeployConfig,
    tokens: Map<string, MarginlyConfigToken>
  ): Map<string, PriceOracleConfig> {
    const priceOracles = new Map<string, PriceOracleConfig>();

    for (let i = 0; i < config.priceOracles.length; i++) {
      const priceOracleConfig = config.priceOracles[i];
      const priceOracleId = priceOracleConfig.id;

      if (isUniswapV3OracleConfig(priceOracleConfig)) {
        const strictConfig: UniswapV3TickOracleConfig = {
          id: priceOracleId,
          type: priceOracleConfig.type,
          settings: priceOracleConfig.settings.map((x) => ({
            quoteToken:
              tokens.get(x.quoteTokenId) ||
              (() => {
                throw new Error(`Quote token not found by id ${x.quoteTokenId}`);
              })(),
            baseToken:
              tokens.get(x.baseTokenId) ||
              (() => {
                throw new Error(`Base token not found by id ${x.baseTokenId}`);
              })(),
            secondsAgo: TimeSpan.parse(x.secondsAgo),
            secondsAgoLiquidation: TimeSpan.parse(x.secondsAgoLiquidation),
            uniswapFee: RationalNumber.parsePercent(x.uniswapFee),
          })),
        };

        priceOracles.set(priceOracleId, strictConfig);
      } else if (isUniswapV3DoubleOracleConfig(priceOracleConfig)) {
        const strictConfig: UniswapV3TickDoubleOracleConfig = {
          id: priceOracleId,
          type: priceOracleConfig.type,
          settings: priceOracleConfig.settings.map((x) => ({
            quoteToken:
              tokens.get(x.quoteTokenId) ||
              (() => {
                throw new Error(`Quote token not found by id ${x.quoteTokenId}`);
              })(),
            baseToken:
              tokens.get(x.baseTokenId) ||
              (() => {
                throw new Error(`Base token not found by id ${x.baseTokenId}`);
              })(),
            intermediateToken:
              tokens.get(x.intermediateTokenId) ||
              (() => {
                throw new Error(`Interm token not found by id ${x.baseTokenId}`);
              })(),
            secondsAgo: TimeSpan.parse(x.secondsAgo),
            secondsAgoLiquidation: TimeSpan.parse(x.secondsAgoLiquidation),
            baseTokenPairFee: RationalNumber.parsePercent(x.baseTokenPairFee),
            quoteTokenPairFee: RationalNumber.parsePercent(x.quoteTokenPairFee),
          })),
        };

        priceOracles.set(priceOracleId, strictConfig);
      } else if (isChainlinkOracleConfig(priceOracleConfig)) {
        const strictConfig: ChainlinkOracleConfig = {
          id: priceOracleId,
          type: priceOracleConfig.type,
          settings: priceOracleConfig.settings.map((x, i) => {
            if (isSinglePairChainlinkOracleDeployConfig(x)) {
              return {
                type: x.type,
                quoteToken:
                  tokens.get(x.quoteTokenId) ||
                  (() => {
                    throw new Error(`Quote token not found by id ${x.quoteTokenId}`);
                  })(),
                baseToken:
                  tokens.get(x.baseTokenId) ||
                  (() => {
                    throw new Error(`Base token not found by id ${x.baseTokenId}`);
                  })(),
                aggregatorV3: EthAddress.parse(x.aggregatorV3),
              } as SinglePairChainlinkOracleConfig;
            } else if (isDoublePairChainlinkOracleDeployConfig(x)) {
              return {
                type: x.type,
                quoteToken:
                  tokens.get(x.quoteTokenId) ||
                  (() => {
                    throw new Error(`Quote token not found by id ${x.quoteTokenId}`);
                  })(),
                baseToken:
                  tokens.get(x.baseTokenId) ||
                  (() => {
                    throw new Error(`Base token not found by id ${x.baseTokenId}`);
                  })(),
                intermediateToken:
                  tokens.get(x.intermediateTokenId) ||
                  (() => {
                    throw new Error(`Intermediate token not found by id ${x.intermediateTokenId}`);
                  })(),
                baseAggregatorV3: EthAddress.parse(x.baseAggregatorV3),
                quoteAggregatorV3: EthAddress.parse(x.quoteAggregatorV3),
              } as DoublePairChainlinkOracleConfig;
            } else {
              throw new Error(`Unknown pair type at index ${i} on ${priceOracleConfig.id}`);
            }
          }),
        };

        priceOracles.set(priceOracleId, strictConfig);
      } else if (isPythOracleConfig(priceOracleConfig)) {
        const strictConfig: PythOracleConfig = {
          id: priceOracleId,
          type: priceOracleConfig.type,
          pyth: EthAddress.parse(priceOracleConfig.pyth),
          settings: priceOracleConfig.settings.map((x, i) => {
            if (isSinglePairPythOracleDeployConfig(x)) {
              if (!ethers.utils.isHexString(x.pythPriceId, 32)) {
                throw new Error(`Invalid pythPriceId for ${priceOracleConfig.id}`);
              }
              return {
                type: x.type,
                quoteToken:
                  tokens.get(x.quoteTokenId) ||
                  (() => {
                    throw new Error(`Quote token not found by id ${x.quoteTokenId}`);
                  })(),
                baseToken:
                  tokens.get(x.baseTokenId) ||
                  (() => {
                    throw new Error(`Base token not found by id ${x.baseTokenId}`);
                  })(),
                pythPriceId: x.pythPriceId as `0x{string}`,
              } as SinglePairPythOracleConfig;
            } else if (isDoublePairPythOracleDeployConfig(x)) {
              if (!ethers.utils.isHexString(x.basePythPriceId, 32)) {
                throw new Error(`Invalid basePythPriceId for ${priceOracleConfig.id}`);
              }
              if (!ethers.utils.isHexString(x.quotePythPriceId, 32)) {
                throw new Error(`Invalid quotePythPriceId for ${priceOracleConfig.id}`);
              }

              return {
                type: x.type,
                quoteToken:
                  tokens.get(x.quoteTokenId) ||
                  (() => {
                    throw new Error(`Quote token not found by id ${x.quoteTokenId}`);
                  })(),
                baseToken:
                  tokens.get(x.baseTokenId) ||
                  (() => {
                    throw new Error(`Base token not found by id ${x.baseTokenId}`);
                  })(),
                intermediateToken:
                  tokens.get(x.intermediateTokenId) ||
                  (() => {
                    throw new Error(`Base token not found by id ${x.intermediateTokenId}`);
                  })(),
                basePythPriceId: x.basePythPriceId as `0x{string}`,
                quotePythPriceId: x.quotePythPriceId as `0x{string}`,
              } as DoublePairPythOracleConfig;
            } else {
              throw new Error(`Unknown pair type at index ${i} on ${priceOracleConfig.id}`);
            }
          }),
        };

        priceOracles.set(priceOracleId, strictConfig);
      }
    }

    return priceOracles;
  }
}
