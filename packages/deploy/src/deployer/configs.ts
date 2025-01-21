import { MarginlyConfigExistingToken, MarginlyConfigMintableToken, MarginlyConfigToken, TimeSpan } from '../common';
import { EthAddress, RationalNumber } from '@marginly/common';
import {
  EthConnectionConfig,
  GeneralAdapterPair,
  isAlgebraDoubleOracleConfig,
  isAlgebraOracleConfig,
  isChainlinkOracleConfig,
  isCurveOracleConfig,
  isDoublePairChainlinkOracleDeployConfig,
  isDoublePairPythOracleDeployConfig,
  isMarginlyDeployConfigExistingToken,
  isMarginlyDeployConfigMintableToken,
  isPendleMarketOracleConfig,
  isPendleOracleConfig,
  isPythOracleConfig,
  isSinglePairChainlinkOracleDeployConfig,
  isSinglePairPythOracleDeployConfig,
  isUniswapV3DoubleOracleConfig,
  isUniswapV3OracleConfig,
  MarginlyDeployConfig,
  PendleCurveAdapterPair,
  PendleCurveRouterAdapterPair,
  PendleMarketAdapterPair,
  PendleUniswapAdapterPair,
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
  factory: EthAddress;
  tokenA: MarginlyConfigToken;
  tokenB: MarginlyConfigToken;
  fee: RationalNumber;
  allowCreate: boolean;
  assertAddress?: EthAddress;
}

export interface MarginlyConfigUniswapGenuine {
  type: 'genuine';
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
  timelockOwner?: EthAddress;
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
  baseToken: MarginlyConfigToken;
  quoteToken: MarginlyConfigToken;
  params: MarginlyPoolParams;
  defaultSwapCallData: number;
  priceOracle: PriceOracleConfig;
}

export type AdapterParam =
  | MarginlyAdapterParam
  | PendleAdapterParam
  | PendleMarketAdapterParam
  | PendleCurveAdapterParam
  | PendleCurveRouterAdapterParam;

export interface MarginlyAdapterParam {
  type: 'general';
  token0: MarginlyConfigToken;
  token1: MarginlyConfigToken;
  pool: EthAddress;
}

export interface PendleAdapterParam {
  type: 'pendle';
  token0: MarginlyConfigToken;
  token1: MarginlyConfigToken;
  ib: MarginlyConfigToken;
  pendleMarket: EthAddress;
  uniswapV3LikePool: EthAddress;
  slippage: number;
}

export interface PendleMarketAdapterParam {
  type: 'pendleMarket';
  ptToken: MarginlyConfigToken;
  ibToken: MarginlyConfigToken;
  pendleMarket: EthAddress;
  slippage: number;
}

export interface PendleCurveRouterAdapterParam {
  type: 'pendleCurveRouter';
  pendleMarket: EthAddress;
  slippage: number;
  curveSlippage: number;
  curveRoute: EthAddress[]; // array of fixed length 11
  curveSwapParams: number[][]; // array of fixed length 5 x 5
  curvePools: EthAddress[]; // array of fixed length 5
}

export interface PendleCurveAdapterParam {
  type: 'pendleCurve';
  pendleMarket: EthAddress;
  slippage: number;
  curveSlippage: number;
  curvePool: EthAddress;
  ibToken: MarginlyConfigToken;
  quoteToken: MarginlyConfigToken;
}

export function isPendleAdapter(config: AdapterParam): config is PendleAdapterParam {
  return config.type === 'pendle';
}

export function isPendleMarketAdapter(config: AdapterParam): config is PendleMarketAdapterParam {
  return config.type === 'pendleMarket';
}

export function isGeneralAdapter(config: AdapterParam): config is MarginlyAdapterParam {
  return config.type === 'general';
}

export function isPendleCurveRouterAdapter(config: AdapterParam): config is PendleCurveRouterAdapterParam {
  return config.type === 'pendleCurveRouter';
}

export function isPendleCurveAdapter(config: AdapterParam): config is PendleCurveAdapterParam {
  return config.type === 'pendleCurve';
}

export interface MarginlyConfigAdapter {
  dexId: BigNumber;
  name: string;
  balancerVault?: EthAddress;
  curveRouter?: EthAddress;
  marginlyAdapterParams: AdapterParam[];
}

export interface MarginlyConfigMarginlyRouter {
  adapters: MarginlyConfigAdapter[];
}

export interface MarginlyConfigMarginlyKeeper {
  aaveKeeper?: {
    aavePoolAddressProvider: EthAddress;
  };
  aaveMock: boolean;
  uniswapKeeper: boolean;
  algebraKeeper: boolean;
  balancerKeeper?: {
    balancerVault: EthAddress;
  };
}

export type PriceOracleConfig =
  | UniswapV3TickOracleConfig
  | UniswapV3TickDoubleOracleConfig
  | ChainlinkOracleConfig
  | PythOracleConfig
  | PendleOracleConfig
  | PendleMarketOracleConfig
  | AlgebraOracleConfig
  | AlgebraDoubleOracleConfig
  | CurveOracleConfig;

export interface UniswapV3TickOracleConfig {
  id: string;
  type: 'uniswapV3';
  factory: EthAddress;
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
  factory: EthAddress;
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

export interface AlgebraOracleConfig {
  id: string;
  type: 'algebra';
  factory: EthAddress;
  settings: {
    quoteToken: MarginlyConfigToken;
    baseToken: MarginlyConfigToken;
    secondsAgo: TimeSpan;
    secondsAgoLiquidation: TimeSpan;
  }[];
}

export interface AlgebraDoubleOracleConfig {
  id: string;
  type: 'algebraDouble';
  factory: EthAddress;
  settings: {
    quoteToken: MarginlyConfigToken;
    baseToken: MarginlyConfigToken;
    intermediateToken: MarginlyConfigToken;
    secondsAgo: TimeSpan;
    secondsAgoLiquidation: TimeSpan;
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

export interface PendleOracleConfig {
  id: string;
  type: 'pendle';
  pendlePtLpOracle: EthAddress;
  settings: {
    quoteToken: MarginlyConfigToken;
    baseToken: MarginlyConfigToken;
    pendleMarket: EthAddress;
    secondaryPoolOracleId: string;
    ibToken: MarginlyConfigToken;
    secondsAgo: TimeSpan;
    secondsAgoLiquidation: TimeSpan;
  }[];
}

export interface PendleMarketOracleConfig {
  id: string;
  type: 'pendleMarket';
  pendlePtLpOracle: EthAddress;
  settings: {
    quoteToken: MarginlyConfigToken;
    baseToken: MarginlyConfigToken;
    pendleMarket: EthAddress;
    secondsAgo: TimeSpan;
    secondsAgoLiquidation: TimeSpan;
  }[];
}

export interface CurveOracleConfig {
  id: string;
  type: 'curve';
  settings: {
    pool: EthAddress;
    quoteToken: MarginlyConfigToken;
    baseToken: MarginlyConfigToken;
  }[];
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

export function isPendleOracle(config: PriceOracleConfig): config is PendleOracleConfig {
  return config.type === 'pendle';
}

export function isPendleMarketOracle(config: PriceOracleConfig): config is PendleMarketOracleConfig {
  return config.type === 'pendleMarket';
}

export function isAlgebraOracle(config: PriceOracleConfig): config is AlgebraOracleConfig {
  return config.type === 'algebra';
}

export function isAlgebraDoubleOracle(config: PriceOracleConfig): config is AlgebraDoubleOracleConfig {
  return config.type === 'algebraDouble';
}

export function isCurveOracle(config: PriceOracleConfig): config is CurveOracleConfig {
  return config.type === 'curve';
}

export class StrictMarginlyDeployConfig {
  public readonly connection: EthConnectionConfig;
  public readonly tokens: MarginlyConfigToken[];
  public readonly priceOracles: PriceOracleConfig[];
  public readonly marginlyFactory: MarginlyFactoryConfig;
  public readonly marginlyPools: MarginlyConfigMarginlyPool[];
  public readonly marginlyKeeper: MarginlyConfigMarginlyKeeper;
  public readonly marginlyRouter: MarginlyConfigMarginlyRouter;

  private constructor(
    connection: EthConnectionConfig,
    priceOracles: PriceOracleConfig[],
    marginlyFactory: MarginlyFactoryConfig,
    tokens: MarginlyConfigToken[],
    marginlyPools: MarginlyConfigMarginlyPool[],
    marginlyKeeper: MarginlyConfigMarginlyKeeper,
    marginlyRouter: MarginlyConfigMarginlyRouter
  ) {
    this.connection = connection;
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

    const priceOracles = this.createPriceOracleConfigs(config, tokens);

    const marginlyPools: MarginlyConfigMarginlyPool[] = [];
    for (let i = 0; i < config.marginlyPools.length; i++) {
      const rawPool = config.marginlyPools[i];

      const baseToken = tokens.get(rawPool.baseTokenId);
      if (baseToken === undefined) {
        throw new Error(`Base token with id '${rawPool.baseTokenId}' is not found for marginly pool '${rawPool.id}'`);
      }
      const quoteToken = tokens.get(rawPool.quoteTokenId);
      if (quoteToken === undefined) {
        throw new Error(`Quote token with id '${rawPool.quoteTokenId}' is not found for marginly pool '${rawPool.id}'`);
      }

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
        baseToken,
        quoteToken,
        params,
        defaultSwapCallData: rawPool.defaultSwapCallData,
        priceOracle,
      });
    }

    const adapters: MarginlyConfigAdapter[] = [];

    for (const adapter of config.adapters) {
      const adapterParams: AdapterParam[] = [];
      for (const pool of adapter.pools) {
        if (adapter.adapterName === 'PendleAdapter') {
          const pairConfig = pool as PendleUniswapAdapterPair;

          if (!pairConfig.ibTokenId) {
            throw new Error(`IB token id is not set for adapter with dexId ${adapter.dexId}`);
          }
          if (!pairConfig.slippage) {
            throw new Error(`Slippage is not set for adapter with dexId ${adapter.dexId}`);
          }
          if (!pairConfig.pendleMarket) {
            throw new Error(`Pendle market is not set for adapter with dexId ${adapter.dexId}`);
          }

          const poolAddress = EthAddress.parse(pairConfig.poolAddress);
          const token0 = tokens.get(pairConfig.tokenAId);
          if (token0 === undefined) {
            throw new Error(`Can not find token0 '${pairConfig.tokenAId}' for adapter with dexId ${adapter.dexId}`);
          }
          const token1 = tokens.get(pairConfig.tokenBId);
          if (token1 === undefined) {
            throw new Error(`Can not find token1 '${pairConfig.tokenBId}' for adapter with dexId ${adapter.dexId}`);
          }
          const ibToken = tokens.get(pairConfig.ibTokenId);
          if (ibToken === undefined) {
            throw new Error(`Can not find ibToken '${pairConfig.ibTokenId}' for adapter with dexId ${adapter.dexId}`);
          }

          adapterParams.push({
            type: 'pendle',
            token0: token0,
            token1: token1,
            ib: ibToken,
            uniswapV3LikePool: poolAddress,
            pendleMarket: EthAddress.parse(pairConfig.pendleMarket),
            slippage: pairConfig.slippage,
          });
        } else if (adapter.adapterName === 'PendleMarketAdapter') {
          const pairConfig = pool as PendleMarketAdapterPair;

          const token0 = tokens.get(pairConfig.tokenAId);
          if (token0 === undefined) {
            throw new Error(`Can not find token0 '${pairConfig.tokenAId}' for adapter with dexId ${adapter.dexId}`);
          }
          const token1 = tokens.get(pairConfig.tokenBId);
          if (token1 === undefined) {
            throw new Error(`Can not find token1 '${pairConfig.tokenBId}' for adapter with dexId ${adapter.dexId}`);
          }

          adapterParams.push({
            type: 'pendleMarket',
            ptToken: token0,
            ibToken: token1,
            pendleMarket: EthAddress.parse(pairConfig.poolAddress),
            slippage: pairConfig.slippage,
          });
        } else if (adapter.adapterName === 'PendleCurveNgAdapter') {
          const pairConfig = pool as PendleCurveAdapterPair;

          const ibToken = tokens.get(pairConfig.ibTokenId);
          if (ibToken === undefined) {
            throw new Error(`Can not find ibToken '${pairConfig.ibTokenId}' for adapter with dexId ${adapter.dexId}`);
          }

          const quoteToken = tokens.get(pairConfig.quoteTokenId);
          if (quoteToken === undefined) {
            throw new Error(
              `Can not find quoteToken '${pairConfig.quoteTokenId}' for adapter with dexId ${adapter.dexId}`
            );
          }

          adapterParams.push(<PendleCurveAdapterParam>{
            type: 'pendleCurve',
            pendleMarket: EthAddress.parse(pairConfig.pendleMarket),
            slippage: pairConfig.slippage,
            curveSlippage: pairConfig.curveSlippage,
            curvePool: EthAddress.parse(pairConfig.curvePool),
            ibToken: ibToken,
            quoteToken: quoteToken,
          });
        } else if (adapter.adapterName === 'PendleCurveRouterNg') {
          const pairConfig = pool as PendleCurveRouterAdapterPair;

          if (pairConfig.curveRoute.length !== 11) {
            throw new Error(
              `Wrong config for Pendle curve router adapter with dexId ${adapter.dexId}. Curve route length must be 11`
            );
          }

          if (pairConfig.curvePools.length !== 5) {
            throw new Error(
              `Wrong config for Pendle curve router adapter with dexId ${adapter.dexId}. Curve pools length must be 5`
            );
          }

          if (pairConfig.curveSwapParams.length !== 5) {
            throw new Error(
              `Wrong config for Pendle curve router adapter with dexId ${adapter.dexId}. Curve swap params array must be 5x5`
            );
          }

          for (let i = 0; i < 5; i++) {
            if (pairConfig.curveSwapParams[i].length !== 5) {
              throw new Error(
                `Wrong config for Pendle curve router adapter with dexId ${adapter.dexId}. Curve swap params array must be 5x5`
              );
            }
          }

          adapterParams.push(<PendleCurveRouterAdapterParam>{
            type: 'pendleCurveRouter',
            pendleMarket: EthAddress.parse(pairConfig.pendleMarket),
            slippage: pairConfig.slippage,
            curveSlippage: pairConfig.curveSlippage,
            curveRoute: pairConfig.curveRoute.map(EthAddress.parse),
            curveSwapParams: pairConfig.curveSwapParams,
            curvePools: pairConfig.curvePools.map(EthAddress.parse),
          });
        } else {
          const pairConfig = pool as GeneralAdapterPair;

          const poolAddress = EthAddress.parse(pairConfig.poolAddress);
          const token0 = tokens.get(pairConfig.tokenAId);
          if (token0 === undefined) {
            throw new Error(`Can not find token0 '${pairConfig.tokenAId}' for adapter with dexId ${adapter.dexId}`);
          }
          const token1 = tokens.get(pairConfig.tokenBId);
          if (token1 === undefined) {
            throw new Error(`Can not find token1 '${pairConfig.tokenBId}' for adapter with dexId ${adapter.dexId}`);
          }
          adapterParams.push({
            type: 'general',
            token0: token0,
            token1: token1,
            pool: poolAddress,
          });
        }
      }

      adapters.push({
        dexId: BigNumber.from(adapter.dexId),
        balancerVault: adapter.balancerVault ? EthAddress.parse(adapter.balancerVault) : undefined,
        curveRouter: adapter.curveRouter ? EthAddress.parse(adapter.curveRouter) : undefined,
        name: adapter.adapterName,
        marginlyAdapterParams: adapterParams,
      });
    }

    const marginlyRouter: MarginlyConfigMarginlyRouter = { adapters };

    const marginlyKeeper: MarginlyConfigMarginlyKeeper = {
      aaveKeeper: config.marginlyKeeper.aaveKeeper
        ? {
            aavePoolAddressProvider: EthAddress.parse(config.marginlyKeeper.aaveKeeper.aavePoolAddressesProvider),
          }
        : undefined,
      aaveMock: false,
      uniswapKeeper: config.marginlyKeeper.uniswapKeeper ?? false,
      algebraKeeper: config.marginlyKeeper.algebraKeeper ?? false,
      balancerKeeper: config.marginlyKeeper.balancerKeeper
        ? {
            balancerVault: EthAddress.parse(config.marginlyKeeper.balancerKeeper.balancerVault),
          }
        : undefined,
    };

    const wethToken = tokens.get(config.marginlyFactory.wethTokenId);
    if (wethToken === undefined) {
      throw new Error(`Can not find WETH token by tokenId'${config.marginlyFactory.wethTokenId} for marginly factory`);
    }

    return new StrictMarginlyDeployConfig(
      config.connection,
      Array.from(priceOracles.values()),
      {
        feeHolder: EthAddress.parse(config.marginlyFactory.feeHolder),
        techPositionOwner: EthAddress.parse(config.marginlyFactory.techPositionOwner),
        weth9Token: wethToken,
        timelockOwner: config.marginlyFactory.timelockOwner
          ? EthAddress.parse(config.marginlyFactory.timelockOwner)
          : undefined,
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
          factory: EthAddress.parse(priceOracleConfig.factory),
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
          factory: EthAddress.parse(priceOracleConfig.factory),
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
      } else if (isPendleOracleConfig(priceOracleConfig)) {
        const strictConfig: PendleOracleConfig = {
          id: priceOracleId,
          type: priceOracleConfig.type,
          pendlePtLpOracle: EthAddress.parse(priceOracleConfig.pendlePtLpOracle),
          settings: priceOracleConfig.settings.map((x) => {
            return {
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
              pendleMarket: EthAddress.parse(x.pendleMarket),
              ibToken:
                tokens.get(x.ibTokenId) ||
                (() => {
                  throw new Error(`IB token not found by id ${x.ibTokenId}`);
                })(),
              secondsAgo: TimeSpan.parse(x.secondsAgo),
              secondsAgoLiquidation: TimeSpan.parse(x.secondsAgoLiquidation),
              secondaryPoolOracleId: x.secondaryPoolOracleId,
            };
          }),
        };

        priceOracles.set(priceOracleId, strictConfig);
      } else if (isPendleMarketOracleConfig(priceOracleConfig)) {
        const strictConfig: PendleMarketOracleConfig = {
          id: priceOracleId,
          type: priceOracleConfig.type,
          pendlePtLpOracle: EthAddress.parse(priceOracleConfig.pendlePtLpOracle),
          settings: priceOracleConfig.settings.map((x) => {
            return {
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
              pendleMarket: EthAddress.parse(x.pendleMarket),
              secondsAgo: TimeSpan.parse(x.secondsAgo),
              secondsAgoLiquidation: TimeSpan.parse(x.secondsAgoLiquidation),
            };
          }),
        };

        priceOracles.set(priceOracleId, strictConfig);
      } else if (isAlgebraOracleConfig(priceOracleConfig)) {
        const strictConfig: AlgebraOracleConfig = {
          id: priceOracleId,
          type: priceOracleConfig.type,
          factory: EthAddress.parse(priceOracleConfig.factory),
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
          })),
        };

        priceOracles.set(priceOracleId, strictConfig);
      } else if (isAlgebraDoubleOracleConfig(priceOracleConfig)) {
        const strictConfig: AlgebraDoubleOracleConfig = {
          id: priceOracleId,
          type: priceOracleConfig.type,
          factory: EthAddress.parse(priceOracleConfig.factory),
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
          })),
        };
      } else if (isCurveOracleConfig(priceOracleConfig)) {
        const strictConfig: CurveOracleConfig = {
          id: priceOracleId,
          type: priceOracleConfig.type,
          settings: priceOracleConfig.settings.map((x) => {
            return {
              pool: EthAddress.parse(x.pool),
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
            };
          }),
        };

        priceOracles.set(priceOracleId, strictConfig);
      }
    }

    return priceOracles;
  }
}
