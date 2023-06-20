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

export interface PricesRepositoryConfig {
  priceCachePeriodMs: number,
  prices: RootPriceConfig[];
}

interface OracleWorkerEthereumConfig {
  nodeUrl: string;
  oraclePrivateKey?: string;
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

interface UpdatePriceJobConfig {
  poolMockId: string;
  periodMs: number
}

export interface OracleWorkerConfig {
  id: string;
  tickMs: number,
  ethereum: OracleWorkerEthereumConfig,
  tokens: TokenConfig[],
  uniswapV3PoolMocks: UniswapV3PoolMockConfig[];
  updatePriceJobs: UpdatePriceJobConfig[]
}

interface WorkerManagerConfig {
  sequentialFailsThresholdMs: number;
  restartDelayMs: number;
}

export interface Config {
  log: LogConfig;
  pricesRepository: PricesRepositoryConfig;
  ethereum: EthereumConfig;
  workerManager: WorkerManagerConfig;
  oracleWorkers: OracleWorkerConfig[];
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

interface StrictOracleWorkerEthereumConfig {
  nodeUrl: string;
  oraclePrivateKey: string;
}

export interface StrictOracleWorkerConfig {
  id: string;
  tickMs: number,
  ethereum: StrictOracleWorkerEthereumConfig,
  tokens: StrictTokenConfig[],
  uniswapV3PoolMocks: UniswapV3PoolMockConfig[];
  updatePriceJobs: UpdatePriceJobConfig[]
}

export interface StrictConfig {
  log: StrictLogConfig;
  pricesRepository: PricesRepositoryConfig;
  workerManager: WorkerManagerConfig;
  oracleWorkers: StrictOracleWorkerConfig[];
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

  const configFileKey = `${envPrefix}CONFIG_FILE`;
  const configFile = process.env[configFileKey] ?? 'config.json';

  const config: Config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
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
  ethereumConfig: EthereumConfig
): StrictOracleWorkerConfig {
  const idSet = new Set<string>();

  for (const job of config.updatePriceJobs) {
    if (idSet.has(job.poolMockId)) {
      throw new Error(`Pool mock id '${job.poolMockId}' used in multiple jobs`);
    }
  }

  const tokens: StrictTokenConfig[] = config.tokens.map(x => ({
    id: x.id,
    address: EthAddress.parse(x.address),
    assertDecimals: x.assertDecimals,
    assertSymbol: x.assertSymbol,
  }));

  return {
    id: config.id,
    tickMs: config.tickMs,
    ethereum: {
      nodeUrl: config.ethereum.nodeUrl,
      oraclePrivateKey: config.ethereum.oraclePrivateKey ?? ethereumConfig.oraclePrivateKey,
    },
    tokens,
    uniswapV3PoolMocks: config.uniswapV3PoolMocks,
    updatePriceJobs: config.updatePriceJobs
  };
}

export function parseConfig(config: Config): StrictConfig {
  const workerIds = new Set<string>();

  for (const workerConfig of config.oracleWorkers) {
    if (workerIds.has(workerConfig.id)) {
      throw new Error(`Duplicate worker id ${workerConfig.id}`);
    }
    workerIds.add(workerConfig.id);
  }

  const oracleWorkers = config.oracleWorkers.map(x => parseOracleWorkerConfig(x, config.ethereum));

  return {
    log: parseLogConfig(config.log),
    pricesRepository: config.pricesRepository,
    workerManager: config.workerManager,
    oracleWorkers
  };
}
