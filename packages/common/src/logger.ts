import {ErrorAware, Resource} from "./resource";

export interface LoggerFunction {
    (fields: Record<string, unknown>): void;

    (message: string, fields?: Record<string, unknown>): void;

    (error: Error, fields: Record<string, unknown>): void;

    (error: unknown, fields: Record<string, unknown>): void;

    (error: Error, message?: string, fields?: Record<string, unknown>): void;

    (error: unknown, message?: string, fields?: Record<string, unknown>): void;
}

export interface Logger extends Resource, ErrorAware{
    verbose: LoggerFunction;
    debug: LoggerFunction;
    info: LoggerFunction;
    warn: LoggerFunction;
    error: LoggerFunction;
    fatal: LoggerFunction;

    scope: (name: string, fields?: Record<string, unknown>) => Logger;

    augmentError: (error: unknown) => void;
    augmentErrorAndThrow: (error: unknown) => never;
}