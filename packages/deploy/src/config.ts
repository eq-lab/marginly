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
  factory?: string;
  pools: {
    id: string;
    tokenAId: string;
    tokenBId: string;
    fee: string;
    priceAdapter: {
      priceProvidersMock?: {
        basePriceProviderMock?: {
          oracle: string;
          decimals: string;
        };
        quotePriceProviderMock?: {
          oracle: string;
          decimals: string;
        };
      };
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
  };
  adminContract?: boolean;
  marginlyPools: {
    id: string;
    uniswapPoolId: string;
    baseTokenId: string;
    params: {
      interestRate: string;
      fee: string;
      maxLeverage: string;
      swapFee: string;
      priceAgo: string;
      priceAgoMC: string;
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
