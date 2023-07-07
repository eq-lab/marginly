/**
 * This Error should cause App to stop as soon as possible.
 * Code should not swallow this error
 */
export class CriticalError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = 'CriticalError';
        Object.setPrototypeOf(this, CriticalError.prototype);
    }
}

export function throwIfCritical(error: unknown): void {
    if (error instanceof CriticalError) {
        throw error;
    }
}
