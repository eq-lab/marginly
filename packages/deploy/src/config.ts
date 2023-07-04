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

export function isMarginlyDeployConfigExistingToken(token: MarginlyDeployConfigToken): token is MarginlyDeployConfigExistingToken {
  return token.type === 'existing' || token.type === undefined;
}

export function isMarginlyDeployConfigMintableToken(token: MarginlyDeployConfigToken): token is MarginlyDeployConfigMintableToken {
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

type MarginlyDeployConfigUniswap = MarginlyDeployConfigUniswapGenuine | MarginlyDeployConfigUniswapMock;
export function isMarginlyDeployConfigUniswapGenuine(uniswap: MarginlyDeployConfigUniswap): uniswap is MarginlyDeployConfigUniswapGenuine {
  return uniswap.type === 'genuine' || uniswap.type === undefined;
}

export function isMarginlyDeployConfigUniswapMock(uniswap: MarginlyDeployConfigUniswap): uniswap is MarginlyDeployConfigUniswapMock {
  return uniswap.type === 'mock';
}

export enum Dex {
  UniswapV3,
  ApeSwap,
  Balancer,
  Camelot,
  KyberSwap,
  QuickSwap,
  SushiSwap,
  TraderJoe,
  Woofi
}

export interface MarginlyDeployConfig {
  connection: EthConnectionConfig;
  tokens: MarginlyDeployConfigToken[];
  prices: RootPriceConfig[];
  uniswap: MarginlyDeployConfigUniswap;
  routerPools: {
    dex: Dex;
    tokenAId: string;
    tokenBId: string;
    fee?: number;
    assertAddress?: string;
  };
  marginlyFactory: {
    feeHolder: string;
    techPositionOwner: string;
    wethTokenId: string;
  };
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
      positionSlippage: string;
      mcSlippage: string;
      positionMinAmount: string;
      baseLimit: string;
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
