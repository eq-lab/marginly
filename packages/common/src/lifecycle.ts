export interface Worker {
    run(): Promise<void>;

    requestStop(): void;
}

export class CancelError extends Error {
    constructor() {
        super('Operation is cancelled');
        Object.setPrototypeOf(this, CancelError.prototype);

        this.name = CancelError.name;
    }
}

export interface CancellationToken {
    isCancelled: () => boolean;
    throwIfCancelled: () => void;
}

export class CancellationTokenSource {
    private isCancelled;
    private token;

    public constructor() {
        this.isCancelled = false;
        this.token = {
            isCancelled: () => this.isCancelled,
            throwIfCancelled: () => {
                if (this.isCancelled) {
                    throw new CancelError();
                }
            },
        };
    }

    public cancel(): void {
        this.isCancelled = true;
    }

    public getToken(): CancellationToken {
        return this.token;
    }
}
