import { Parameter } from '@marginly/cli-common';
import { ContractDescription } from '@marginly/common';
import { LogLevel } from '@marginly/logger';
import { BigNumber } from 'ethers';

export interface LogConfig {
  level: number;
  format: string;
}

export interface EthOptions {
  gasLimit?: number;
  gasPrice?: number;
}

export interface EthConnectionConfig {
  ethOptions: EthOptions;
}

export interface PoolPositionLiquidationConfig {
  keeperType: 'aave' | 'uniswapV3';
  address: string;
  minProfitQuote: string;
  minProfitBase: string;
  flashLoanPools?: string[];
  swapCallData?: string;
}

export interface KeeperConfig {
  systemContextDefaults?: Record<string, string>;
  connection: EthConnectionConfig;
  marginlyKeeperAaveAddress: string;
  marginlyKeeperUniswapV3Address: string;
  marginlyPools: PoolPositionLiquidationConfig[];
  log?: LogConfig;
}

export type LiquidationParams = {
  position: string;
  pool: string;
  asset: string;
  isQuoteAsset: boolean;
  amount: BigNumber;
  config: PoolPositionLiquidationConfig;
};

export type PoolCoeffs = {
  baseCollateralCoeffX96: BigNumber;
  baseDebtCoeffX96: BigNumber;
  quoteCollateralCoeffX96: BigNumber;
  quoteDebtCoeffX96: BigNumber;
  baseDelevCoeffX96: BigNumber;
  quoteDelevCoeffX96: BigNumber;
};

export interface KeeperParamter extends Parameter {
  default?: string;
}

export interface ContractDescriptions {
  token: ContractDescription;
  keeperAave: ContractDescription;
  keeperUniswapV3: ContractDescription;
  marginlyPool: ContractDescription;
  aavePool: ContractDescription;
  uniswapPool: ContractDescription;
}

export interface KeeperArgs {
  config: string;
  logFormat: 'text' | 'json';
  logLevel: LogLevel;
}
