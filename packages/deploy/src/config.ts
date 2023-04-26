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

export interface MarginlyDeployConfig {
  connection: EthConnectionConfig;
  tokens: MarginlyDeployConfigToken[];
  uniswap: {
    factory: string;
    swapRouter: string;
    pools: {
      id: string;
      token0Id: string;
      token1Id: string;
      fee: string;
      allowCreate: boolean;
      assertAddress?: string;
    }[];
  };
  marginlyFactory: {
    feeHolder: string;
  };
  marginlyPools: {
    id: string;
    uniswapPoolId: string;
    baseToken: string;
    quoteToken: string;
    params: {
      interestRate: string;
      maxLeverage: string;
      recoveryMaxLeverage: string;
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
