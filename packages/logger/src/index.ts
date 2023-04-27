import * as util from 'util';
import { onError, Resource} from '@marginly/common/resource';
import {Logger} from '@marginly/common/logger';

export enum LogLevel {
    Verbose = 1,
    Debug = 2,
    Information = 3,
    Warning = 4,
    Error = 5,
    Fatal = 6,
}

export enum LogLevelName {
    Verbose = 'Verbose',
    Debug = 'Debug',
    Information = 'Information',
    Warning = 'Warning',
    Error = 'Error',
    Fatal = 'Fatal',
}

export interface LogRecordBase {
    timestamp: number;
    message?: string;
    logLevelName: LogLevelName;
    logLevel: LogLevel;
    scopeName: string;
}

interface LoggerScope {
    scopeNames: string[];
    fields: Record<string, unknown>;
}

export type LogRecordWriter = (logRecord: {
    eql: LogRecordBase & Record<string, unknown>;
}) => void;

export interface ErrorField {
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

function getLogLevelName(logLevel: LogLevel): LogLevelName {
    switch (logLevel) {
        case LogLevel.Verbose:
            return LogLevelName.Verbose;
        case LogLevel.Debug:
            return LogLevelName.Debug;
        case LogLevel.Information:
            return LogLevelName.Information;
        case LogLevel.Warning:
            return LogLevelName.Warning;
        case LogLevel.Error:
            return LogLevelName.Error;
        case LogLevel.Fatal:
            return LogLevelName.Fatal;
    }
}

function isError(x: unknown): x is Error {
    return x instanceof Error;
}

function isMessage(x: unknown): x is string {
    return typeof x === 'string';
}

function isFields(x: unknown): x is Record<string, unknown> {
    return (
        typeof x === 'object' && !Array.isArray(x) && x !== null && !isError(x)
    );
}

function getParams(
    params: unknown[]
): [unknown, string | undefined, Record<string, unknown> | undefined] {
    const [param1, param2, param3] = params;

    let error;
    let message;
    let fields;

    if (isFields(param2)) {
        fields = param2;

        if (isMessage(param1)) {
            message = param1;
        } else {
            error = param1;
        }
    } else if (isMessage(param2)) {
        error = param1;
        message = param2;

        if (isFields(param3)) {
            fields = param3;
        }
    } else if (isFields(param1)) {
        fields = param1;
    } else if (isMessage(param1)) {
        message = param1;
    } else if (isError(param1)) {
        error = param1;
    } else {
        message = util.format(...params);
    }

    return [error, message, fields];
}

interface ErrorInfo extends Partial<LoggerScope> {
    errorField: ErrorField;
}

const loggerScopeSymbol: unique symbol = Symbol('loggerScope');

function isAugmentedError(
    error: Error
): error is Error & { [loggerScopeSymbol]: LoggerScope } {
    return (error as any)[loggerScopeSymbol] !== undefined;
}

function getErrorInfo(error: unknown): ErrorInfo {
    if (!isError(error)) {
        return {errorField: {}};
    } else {
        if (isAugmentedError(error)) {
            const scope = error[loggerScopeSymbol];
            return {
                scopeNames: scope.scopeNames,
                fields: scope.fields,
                errorField: {
                    error: {
                        name: error.name,
                        message: error.message,
                        stack: error.stack,
                    },
                },
            };
        } else {
            return {
                errorField: {
                    error: {
                        name: error.name,
                        message: error.message,
                        stack: error.stack,
                    },
                },
            };
        }
    }
}

function getMessageField(error: unknown, message?: string): string | undefined {
    if (message !== undefined) {
        return message;
    } else if (isError(error)) {
        return error.message;
    } else {
        return util.format(error);
    }
}

const loggerTemplate =
    (
        service: string,
        scopeNames: string[],
        scopeFields: Record<string, unknown>,
        writer: LogRecordWriter,
        lowestLogLevel: LogLevel
    ) =>
        (logLevel: LogLevel) =>
            (
                ...params: unknown[]
            ): (LogRecordBase & Record<string, unknown>) | undefined => {
                if (logLevel < lowestLogLevel) {
                    return;
                }

                const [error, message, fields] = getParams(params);

                if (
                    error === undefined &&
                    message === undefined &&
                    fields === undefined
                ) {
                    return;
                }

                const errorInfo = getErrorInfo(error);

                const finalFields = errorInfo.fields ?? {
                    ...scopeFields,
                    ...fields,
                };
                const finalScopeNames = errorInfo.scopeNames ?? scopeNames;
                const scopeName = finalScopeNames.join('.');

                const serviceFields: ErrorField & Record<string, unknown> = {
                    ...finalFields,
                    ...errorInfo.errorField,
                };

                writer({
                    eql: {
                        logLevel,
                        logLevelName: getLogLevelName(logLevel),
                        message: getMessageField(errorInfo.errorField.error, message),
                        timestamp: Date.now(),
                        scopeName,
                        [service]: serviceFields,
                    },
                });
            };

function createLogger(
    service: string,
    scopeNames: string[],
    fields: Record<string, unknown>,
    writer: LogRecordWriter,
    lowestLogLevel: LogLevel
): Logger {
    const logger = loggerTemplate(
        service,
        scopeNames,
        fields,
        writer,
        lowestLogLevel
    );

    const augmentError = (error: unknown): void => {
        if (isError(error)) {
            if ((error as any)[loggerScopeSymbol] === undefined) {
                (error as any)[loggerScopeSymbol] = {
                    scopeNames,
                    fields
                };
            }
        }
    }

    return {
        verbose: logger(LogLevel.Verbose),
        debug: logger(LogLevel.Debug),
        info: logger(LogLevel.Information),
        warn: logger(LogLevel.Warning),
        error: logger(LogLevel.Error),
        fatal: logger(LogLevel.Fatal),
        scope: (
            name: string,
            scopeFields: Record<string, unknown> = {}
        ): Logger => {
            return createLogger(
                service,
                [...scopeNames, name],
                {...fields, ...scopeFields},
                writer,
                lowestLogLevel
            );
        },
        augmentError,
        augmentErrorAndThrow: (error: unknown) => {
            augmentError(error);
            throw error;
        },
        close() {
        },
        [onError]: (error: unknown) => {
            augmentError(error)
        }
    };
}

export function createRootLogger(
    service: string,
    writer: LogRecordWriter,
    lowestLogLevel: LogLevel = LogLevel.Information
): Logger {
    return createLogger(
        service,
        [service],
        {},
        writer,
        lowestLogLevel
    );
}

export function interceptConsole(
    logger: Logger,
    con: Console = console
): Resource {
    const original = {
        log: con.log,
        info: con.info,
        debug: con.debug,
        trace: con.trace,
        warn: con.warn,
        error: con.error,
    };

    con.log = (...args) => logger.info(util.format(...args));
    con.info = (...args) => logger.info(util.format(...args));
    con.debug = (...args) => logger.debug(util.format(...args));
    con.trace = (...args) => logger.verbose(util.format(...args));
    con.warn = (...args) => logger.warn(util.format(...args));
    con.error = (...args) => logger.error(util.format(...args));

    return {
        close: () => {
            con.log = original.log;
            con.info = original.info;
            con.debug = original.debug;
            con.trace = original.trace;
            con.warn = original.warn;
            con.error = original.error;
        },
    };
}

export type LogFormatter = (logRecord: {
    eql: LogRecordBase & Record<string, unknown>;
}) => string;

export function jsonFormatter(logRecord: {
    eql: LogRecordBase & Record<string, unknown>;
}): string {
    return JSON.stringify(logRecord);
}

export function textFormatter(logRecord: {
    eql: LogRecordBase & Record<string, unknown>;
}): string {
    return logRecord.eql.message ?? '';
}

export const consoleWriter =
    (format: LogFormatter) =>
        (logRecord: { eql: LogRecordBase & Record<string, unknown> }): void => {
            console.log(format(logRecord));
        };

export function emptyLogRecordWriter(logRecord: {
    eql: LogRecordBase & Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
}): void {
}
