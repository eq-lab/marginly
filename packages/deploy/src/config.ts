import { RootPriceConfig } from '@marginly/common/dist/price';

export interface EthOptions {
  gasLimit?: number;
  gasPrice?: number;
}

export interface EthConnectionConfig {
  ethOptions: EthOptions;
  assertChainId?: number;
}

export interface DeployConfig {
  systemContextDefaults?: Record<string, string>;
}

export interface MarginlyDeployConfigExistingToken {
  type: 'existing' | undefined;
  id: string;
  address: string;
  assertSymbol?: string;
  assertDecimals?: number;
}

export interface MarginlyDeployConfigMintableToken {
  type: 'mintable';
  id: string;
  name: string;
  symbol: string;
  decimals: number;
}

export type MarginlyDeployConfigToken = MarginlyDeployConfigExistingToken | MarginlyDeployConfigMintableToken;

export function isMarginlyDeployConfigExistingToken(
  token: MarginlyDeployConfigToken
): token is MarginlyDeployConfigExistingToken {
  return token.type === 'existing' || token.type === undefined;
}

export function isMarginlyDeployConfigMintableToken(
  token: MarginlyDeployConfigToken
): token is MarginlyDeployConfigMintableToken {
  return token.type === 'mintable';
}

export type PriceOracleDeployConfig =
  | UniswapV3TickOracleDeployConfig
  | UniswapV3DoubleDeployOracleConfig
  | ChainlinkOracleDeployConfig
  | PythOracleDeployConfig;

export interface UniswapV3TickOracleDeployConfig {
  type: 'uniswapV3';
  id: string;
  settings: {
    quoteTokenId: string;
    baseTokenId: string;
    secondsAgo: string;
    secondsAgoLiquidation: string;
    uniswapFee: string;
  }[];
}

export interface UniswapV3DoubleDeployOracleConfig {
  type: 'uniswapV3Double';
  id: string;
  settings: {
    quoteTokenId: string;
    baseTokenId: string;
    intermediateTokenId: string;
    secondsAgo: string;
    secondsAgoLiquidation: string;
    baseTokenPairFee: string;
    quoteTokenPairFee: string;
  }[];
}

export interface SinglePairChainlinkOracleDeployConfig {
  type: 'single';
  quoteTokenId: string;
  baseTokenId: string;
  aggregatorV3: string;
}

export interface DoublePairChainlinkOracleDeployConfig {
  type: 'double';
  quoteTokenId: string;
  baseTokenId: string;
  intermediateTokenId: string;
  quoteAggregatorV3: string;
  baseAggregatorV3: string;
}

export type PairChainlinkOracleDeployConfig =
  | SinglePairChainlinkOracleDeployConfig
  | DoublePairChainlinkOracleDeployConfig;

export function isSinglePairChainlinkOracleDeployConfig(
  config: PairChainlinkOracleDeployConfig
): config is SinglePairChainlinkOracleDeployConfig {
  return config.type === 'single';
}

export function isDoublePairChainlinkOracleDeployConfig(
  config: PairChainlinkOracleDeployConfig
): config is DoublePairChainlinkOracleDeployConfig {
  return config.type === 'double';
}

export interface ChainlinkOracleDeployConfig {
  type: 'chainlink';
  id: string;
  settings: PairChainlinkOracleDeployConfig[];
}

export interface SinglePairPythOracleDeployConfig {
  type: 'single';
  quoteTokenId: string;
  baseTokenId: string;
  pythPriceId: string;
}

export interface DoublePairPythOracleDeployConfig {
  type: 'double';
  quoteTokenId: string;
  baseTokenId: string;
  intermediateTokenId: string;
  basePythPriceId: string;
  quotePythPriceId: string;
}

export type PairPythOracleDeployConfig = SinglePairPythOracleDeployConfig | DoublePairPythOracleDeployConfig;

export function isSinglePairPythOracleDeployConfig(
  config: PairPythOracleDeployConfig
): config is SinglePairPythOracleDeployConfig {
  return config.type === 'single';
}

export function isDoublePairPythOracleDeployConfig(
  config: PairPythOracleDeployConfig
): config is DoublePairPythOracleDeployConfig {
  return config.type === 'double';
}

export interface PythOracleDeployConfig {
  type: 'pyth';
  id: string;
  pyth: string;
  settings: PairPythOracleDeployConfig[];
}

export function isUniswapV3OracleConfig(config: PriceOracleDeployConfig): config is UniswapV3TickOracleDeployConfig {
  return config.type === 'uniswapV3';
}

export function isUniswapV3DoubleOracleConfig(
  config: PriceOracleDeployConfig
): config is UniswapV3DoubleDeployOracleConfig {
  return config.type === 'uniswapV3Double';
}

export function isChainlinkOracleConfig(config: PriceOracleDeployConfig): config is ChainlinkOracleDeployConfig {
  return config.type === 'chainlink';
}

export function isPythOracleConfig(config: PriceOracleDeployConfig): config is PythOracleDeployConfig {
  return config.type === 'pyth';
}

interface MarginlyDeployConfigUniswapGenuine {
  type: 'genuine' | undefined;
  factory: string;
  pools: {
    id: string;
    tokenAId: string;
    tokenBId: string;
    fee: string;
    allowCreate: boolean;
    assertAddress?: string;
  }[];
}

interface MarginlyDeployConfigUniswapMock {
  type: 'mock';
  oracle: string;
  weth9TokenId: string;
  priceLogSize: number;
  pools: {
    id: string;
    tokenAId: string;
    tokenBId: string;
    fee: string;
    tokenABalance?: string;
    tokenBBalance?: string;
    priceId: string;
    priceBaseTokenId: string;
  }[];
}

interface MarginlyDeployConfigSwapPoolRegistry {
  type: 'swapPoolRegistry';
  factory: string;
  pools: {
    id: string;
    tokenAId: string;
    tokenBId: string;
    fee: string;
    priceProvidersMock?: {
      basePriceProviderMock?: {
        answer: string;
        decimals: string;
      };
      quotePriceProviderMock?: {
        answer: string;
        decimals: string;
      };
    };
    priceAdapter: {
      basePriceProvider?: string;
      quotePriceProvider?: string;
    };
  }[];
}

type MarginlyDeployConfigUniswap =
  | MarginlyDeployConfigUniswapGenuine
  | MarginlyDeployConfigUniswapMock
  | MarginlyDeployConfigSwapPoolRegistry;
export function isMarginlyDeployConfigUniswapGenuine(
  uniswap: MarginlyDeployConfigUniswap
): uniswap is MarginlyDeployConfigUniswapGenuine {
  return uniswap.type === 'genuine' || uniswap.type === undefined;
}

export function isMarginlyDeployConfigUniswapMock(
  uniswap: MarginlyDeployConfigUniswap
): uniswap is MarginlyDeployConfigUniswapMock {
  return uniswap.type === 'mock';
}

export function isMarginlyDeployConfigSwapPoolRegistry(
  uniswap: MarginlyDeployConfigUniswap
): uniswap is MarginlyDeployConfigSwapPoolRegistry {
  return uniswap.type === 'swapPoolRegistry';
}

export enum Dex {
  UniswapV3,
  ApeSwap,
  Balancer,
  Camelot,
  KyberClassicSwap,
  KyberElasticSwap,
  QuickSwap,
  SushiSwap,
  TraderJoe,
  Woofi,
}

export interface MarginlyDeployConfig {
  connection: EthConnectionConfig;
  tokens: MarginlyDeployConfigToken[];
  prices: RootPriceConfig[];
  uniswap: MarginlyDeployConfigUniswap;
  priceOracles: PriceOracleDeployConfig[];
  adapters: {
    dexId: number;
    adapterName: string;
    balancerVault?: string;
    pools: {
      tokenAId: string;
      tokenBId: string;
      poolAddress: string;
    }[];
  }[];
  marginlyFactory: {
    feeHolder: string;
    techPositionOwner: string;
    wethTokenId: string;
    blastPointsAdmin: string;
  };
  marginlyPools: {
    id: string;
    uniswapPoolId: string;
    baseTokenId: string;
    priceOracleId: string;
    defaultSwapCallData: number;
    params: {
      interestRate: string;
      fee: string;
      maxLeverage: string;
      swapFee: string;
      mcSlippage: string;
      positionMinAmount: string;
      quoteLimit: string;
    };
  }[];
  marginlyKeeper: {
    aavePoolAddressesProvider: {
      address?: string;
      allowCreateMock?: boolean;
    };
  };
}
