import {Logger} from './logger';
import {throwIfCritical} from "./error";
import {using} from "./resource";

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export type Executor = <T>(call: () => Promise<T>) => Promise<T>;

export class RetryFailedError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = 'RetryFailedError';
        Object.setPrototypeOf(this, RetryFailedError.prototype);
    }
}

export interface RetryOptions {
    errorClass?: new (message: string) => Error;
    maxRetries?: number;
    initialRetryDelay?: number;
    retryDelayMultiplier?: number;
    logger: Logger;
}

const retryDefaults = {
    errorClass: RetryFailedError,
    maxRetries: 3,
    initialRetryDelay: 1000,
    retryDelayMultiplier: 1.5,
};

export const retry =
    (options: RetryOptions) =>
        async <T>(call: () => Promise<T>): Promise<T> => {
            return await using(options.logger.scope('retry'), async logger => {
                const ErrorClass = options?.errorClass ?? retryDefaults.errorClass;
                const maxRetries = options?.maxRetries ?? retryDefaults.maxRetries;
                const initialRetryDelay =
                    options?.initialRetryDelay ?? retryDefaults.initialRetryDelay;
                const retryDelayMultiplier =
                    options?.retryDelayMultiplier ?? retryDefaults.retryDelayMultiplier;

                let retry = 0;

                // eslint-disable-next-line no-constant-condition
                while (true) {
                    try {
                        return await call();
                    } catch (error) {
                        throwIfCritical(error);

                        logger.warn(error);
                        retry++;
                        if (retry > maxRetries) {
                            break;
                        }
                        const retryDelay =
                            initialRetryDelay * Math.pow(retryDelayMultiplier, retry);
                        logger.warn(
                            `Failed to execute action. ` +
                            `Sleeping for ${retryDelay} ms ` +
                            `before retry ${retry} of ${maxRetries}`
                        );
                        await sleep(retryDelay);
                    }
                }

                throw new ErrorClass(
                    `Failed to execute action after ${maxRetries} retries.`
                );
            });
        };

export interface TimeoutOptions {
    errorClass?: new (message: string) => Error;
    watchdogTimeoutMs?: number;
}

export class TimeoutError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = 'TimeoutError';
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}

const timeoutDefaults = {
    errorClass: TimeoutError,
    watchdogTimeoutMs: 5 * 60 * 1000,
};

export const timeout =
    (options: TimeoutOptions) =>
        <T>(promise: Promise<T>): Promise<T> => {
            const ErrorClass = options?.errorClass ?? TimeoutError;
            const watchdogTimeoutMs =
                options?.watchdogTimeoutMs ?? timeoutDefaults.watchdogTimeoutMs;

            let cancelWatchdog = false;
            const watchdogStepMs = 1000;
            const watchdog = async () => {
                let elapsed = 0;
                while (elapsed < watchdogTimeoutMs && !cancelWatchdog) {
                    await sleep(watchdogStepMs);
                    elapsed += watchdogStepMs;
                }

                if (cancelWatchdog) {
                    await sleep(watchdogStepMs);
                }
                throw new ErrorClass('Waiting is timed out');
            };
            return Promise.race([promise.then(x => {
                cancelWatchdog = true;
                return x;
            }, e => {
                cancelWatchdog = true;
                throw e;
            }), watchdog()]);
        };

export interface TimeoutRetryOptions {
    retry: RetryOptions;
    timeout: TimeoutOptions;
}

export const timeoutRetry =
    (options: TimeoutRetryOptions) =>
        <T>(call: () => Promise<T>): Promise<T> => {
            const promise = retry(options.retry)(call);
            return timeout(options.timeout)(promise);
        };
