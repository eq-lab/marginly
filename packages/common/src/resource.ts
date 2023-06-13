/* eslint-disable @typescript-eslint/no-explicit-any */
import { CriticalError } from './error';

export interface Resource {
    close(): void;
}

export interface AsyncResource {
    close(): Promise<void>;
}

export const onError: unique symbol = Symbol('onError');

export interface ErrorAware {
    [onError](error: unknown): void;
}

function isErrorAware(obj: Partial<ErrorAware>): obj is ErrorAware {
    return obj[onError] !== undefined;
}

/**
 *
 * @param resource
 * @param action
 * @throws `CriticalError` if `resource.close()` caused an error
 */
export function using<TResource extends Resource | AsyncResource, TReturn>(
    resource: TResource & Partial<ErrorAware>,
    action: (r: TResource) => TReturn
): TReturn extends Promise<infer T>
    ? Promise<T>
    : TResource extends AsyncResource
    ? Promise<TReturn>
    : TReturn {
    const errorWhileCloseMessage = 'Error thrown while resource close';
    const errorWhileOnErrorMessage = 'Error thrown while resource onError';

    let actionRet: TReturn | undefined;
    try {
        actionRet = action(resource);
    } catch (error) {
        // Here action thrown error so assume that it
        // returned ordinary value and not a promise

        if (isErrorAware(resource)) {
            try {
                resource[onError](error);
            } catch {
                throw new CriticalError(errorWhileOnErrorMessage);
            }
        }

        let closeRet: void | Promise<void>;
        try {
            closeRet = resource.close();
        } catch (closeError) {
            throw new CriticalError(errorWhileCloseMessage);
        }

        if (closeRet instanceof Promise) {
            return closeRet.then(
                async () => {
                    throw error;
                },
                async () => {
                    throw new CriticalError(errorWhileCloseMessage);
                }
            ) as any;
        } else {
            throw error;
        }
    }
    // Here actionRet is a succeeded regular value or a promise.
    // Promise can be either succeeded or failed

    if (actionRet instanceof Promise) {
        return actionRet.then(
            async (x) => {
                try {
                    await resource.close();
                } catch (closeError) {
                    throw new CriticalError(errorWhileCloseMessage);
                }
                return x;
            },
            async (error) => {
                if (isErrorAware(resource)) {
                    try {
                        resource[onError](error);
                    } catch (error) {
                        throw new CriticalError(errorWhileOnErrorMessage);
                    }
                }
                try {
                    await resource.close();
                } catch (closeError) {
                    throw new CriticalError(errorWhileCloseMessage);
                }
                throw error;
            }
        ) as any;
    } else {
        let closeRet: void | Promise<void>;
        try {
            closeRet = resource.close();
        } catch (closeError) {
            throw new CriticalError(errorWhileCloseMessage);
        }

        if (closeRet instanceof Promise) {
            return closeRet.then(
                async () => actionRet,
                async () => {
                    throw new CriticalError(errorWhileCloseMessage);
                }
            ) as any;
        } else {
            return actionRet as any;
        }
    }
}
