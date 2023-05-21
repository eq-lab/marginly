import { LogLevel } from '@marginly/logger';
import { RootPriceConfig } from '@marginly/common/price';
import * as fs from 'fs';
import { EthAddress } from '@marginly/common';

export interface LogConfig {
  level: number;
  format: string;
}

interface EthereumConfig {
  nodeUrl: string;
  oraclePrivateKey: string;
}

export interface OracleWorkerConfig {
}

export interface TokenConfig {
  id: string;
  address: string;
  assertSymbol?: string;
  assertDecimals?: number;
}

export interface UniswapV3PoolMockConfig {
  id: string;
  address: string;
  priceId: string;
  priceBaseTokenId: string;
}

export interface Config {
  log: LogConfig;
  ethereum: EthereumConfig;
  oracleWorker: OracleWorkerConfig;
  tokens: TokenConfig[];
  prices: RootPriceConfig[];
  uniswapV3PoolMocks: UniswapV3PoolMockConfig[];
}

export interface StrictLogConfig {
  level: LogLevel;
  format: 'text' | 'json';
}

export interface StrictTokenConfig {
  id: string;
  address: EthAddress;
  assertSymbol?: string;
  assertDecimals?: number;
}

export interface StrictConfig {
  log: StrictLogConfig;
  ethereum: EthereumConfig;
  oracleWorker: OracleWorkerConfig;
  tokens: StrictTokenConfig[];
  prices: RootPriceConfig[];
  uniswapV3PoolMocks: UniswapV3PoolMockConfig[];
}

export function loadConfig(): Config {
  const envPrefix = 'MARGINLY_ORACLE_';

  const privateKeyKey = `${envPrefix}ETHEREUM_ORACLE_PRIVATE_KEY`;

  const privateKey = process.env[privateKeyKey];
  if (privateKey === undefined) {
    throw new Error(`${privateKeyKey} must be set`);
  }

  const logFormatKey = `${envPrefix}LOG_FORMAT`;
  const logFormat = process.env[logFormatKey];

  const config: Config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
  config.ethereum.oraclePrivateKey = privateKey;
  if (logFormat !== undefined) {
    config.log.format = logFormat;
  }
  return config;
}

function parseLogConfig(config: LogConfig): StrictLogConfig {
  if (
    !Number.isInteger(config.level) ||
    config.level < 1 ||
    config.level > 6
  ) {
    throw new Error('Invalid log level');
  }
  if (config.format !== 'text' && config.format !== 'json') {
    throw new Error('Invalid log format');
  }

  return {
    level: config.level,
    format: config.format,
  };
}

function parseOracleWorkerConfig(
  config: OracleWorkerConfig,
): OracleWorkerConfig {
  return config;
}

export function parseConfig(config: Config): StrictConfig {
  const tokens: StrictTokenConfig[] = config.tokens.map(x => ({
    id: x.id,
    address: EthAddress.parse(x.address),
    assertDecimals: x.assertDecimals,
    assertSymbol: x.assertSymbol
  }))

  return {
    log: parseLogConfig(config.log),
    ethereum: config.ethereum,
    oracleWorker: parseOracleWorkerConfig(config.oracleWorker),
    tokens,
    prices: config.prices,
    uniswapV3PoolMocks: config.uniswapV3PoolMocks
  };
}
