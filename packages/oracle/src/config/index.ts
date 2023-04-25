import { LogLevel } from '@marginly/logger';

export interface LogConfig {
    level: number;
    format: string;
}
export interface OracleWorkerConfig {
}

export interface Config {
    log: LogConfig;
    oracleWorker: OracleWorkerConfig;
}

export interface StrictLogConfig {
    level: LogLevel;
    format: 'text' | 'json';
}

export interface StrictConfig {
    log: StrictLogConfig;
    oracleWorker: OracleWorkerConfig;
}

export function loadConfig(): Config {
    const envPrefix = 'EQ_STAKING_';

    return {
        log: {
            level: 3,
            format: 'text',
        },
        oracleWorker: {
        },
    };
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
    config: OracleWorkerConfig
): OracleWorkerConfig {
    return config;
}

export function parseConfig(config: Config): StrictConfig {

    return {
        log: parseLogConfig(config.log),
        oracleWorker: parseOracleWorkerConfig(config.oracleWorker),
    };
}
