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

export type KeeperType = 'reinit' | 'aave' | 'uniswapV3' | 'algebra' | 'balancer';

export type PoolPositionLiquidationConfig =
  | ReinitLiquidationConfig
  | AaveLiquidationConfig
  | UniswapV3LiquidationConfig
  | AlgebraLiquidationConfig
  | BalancerLiquidationConfig;

export interface ReinitLiquidationConfig {
  keeperType: 'reinit';
  address: string;
  minProfitQuote: string;
  minProfitBase: string;
}

export interface AaveLiquidationConfig {
  keeperType: 'aave';
  address: string;
  minProfitQuote: string;
  minProfitBase: string;
  swapCallData: string;
}

export interface UniswapV3LiquidationConfig {
  keeperType: 'uniswapV3';
  address: string;
  minProfitQuote: string;
  minProfitBase: string;
  flashLoanPools: string[];
  swapCallData: string;
}

export interface AlgebraLiquidationConfig {
  keeperType: 'algebra';
  address: string;
  minProfitQuote: string;
  minProfitBase: string;
  flashLoanPools: string[];
  swapCallData: string;
}

export interface BalancerLiquidationConfig {
  keeperType: 'balancer';
  address: string;
  minProfitQuote: string;
  minProfitBase: string;
  swapCallData: string;
}

export function isReinitLiquidationConfig(config: PoolPositionLiquidationConfig): config is ReinitLiquidationConfig {
  return config.keeperType === 'reinit';
}

export function isAaveLiquidationConfig(config: PoolPositionLiquidationConfig): config is AaveLiquidationConfig {
  return config.keeperType === 'aave';
}

export function isUniswapV3LiquidationConfig(
  config: PoolPositionLiquidationConfig
): config is UniswapV3LiquidationConfig {
  return config.keeperType === 'uniswapV3';
}

export function isAlgebraLiquidationConfig(config: PoolPositionLiquidationConfig): config is AlgebraLiquidationConfig {
  return config.keeperType === 'algebra';
}

export function isBalancerLiquidationConfig(
  config: PoolPositionLiquidationConfig
): config is BalancerLiquidationConfig {
  return config.keeperType === 'balancer';
}

export interface KeeperConfig {
  systemContextDefaults?: Record<string, string>;
  connection: EthConnectionConfig;
  keepers: {
    type: KeeperType;
    address: string;
  }[];
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
  keepers: Record<string, ContractDescription>;
  marginlyPool: ContractDescription;
  aavePool: ContractDescription;
  uniswapPool: ContractDescription;
}

export interface KeeperArgs {
  config: string;
  logFormat: 'text' | 'json';
  logLevel: LogLevel;
}
