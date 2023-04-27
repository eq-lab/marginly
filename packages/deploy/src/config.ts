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

export interface MarginlyDeployConfig {
  connection: EthConnectionConfig;
  uniswap: {
    factory: string;
    swapRouter: string;
  };
  marginlyFactory: {
    feeHolder: string;
  };
  tokens: {
    id: string;
    address: string;
    assertSymbol?: string;
    assertDecimals?: number;
  }[];
  uniswapPools: {
    id: string;
    token0Id: string;
    token1Id: string;
    fee: string;
    allowCreate: boolean;
    assertAddress?: string;
  }[];
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
  marginlyWrapper: {
    weth9TokenId: string;
  };
  marginlyKeeper: {
    aavePoolAddressesProvider: {
      address?: string;
      allowCreateMock?: boolean;
    };
  };
}
