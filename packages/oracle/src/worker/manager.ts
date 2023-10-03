import { Worker } from '@marginly/common/lifecycle';
import { StrictConfig } from '../config';
import { Executor } from '@marginly/common/dist/execution';
import { PricesRepository } from '../repository/prices';
import { Logger } from '@marginly/common/logger';
import { OracleWorker } from './worker';
import { sleep } from '@marginly/common';

interface WorkerInfo {
  failedAtMs?: bigint;
  worker: OracleWorker;
  promise: Promise<[string, boolean]>;
}

export class WorkerManager implements Worker {
  private readonly activeWorkers = new Map<string, WorkerInfo>();

  private readonly config: StrictConfig;
  private readonly logger: Logger;
  private readonly executor: Executor;
  private readonly pricesRepository: PricesRepository;

  private stopRequested = false;

  public constructor(config: StrictConfig, logger: Logger, executor: Executor, pricesRepository: PricesRepository) {
    this.config = config;
    this.logger = logger;
    this.executor = executor;
    this.pricesRepository = pricesRepository;
  }

  public requestStop(): void {
    this.stopRequested = true;
    for (const { worker } of this.activeWorkers.values()) {
      worker.requestStop();
    }
  }

  private createWorker(workerId: string, transientState?: string[]): OracleWorker {
    return new OracleWorker(this.config, this.logger, this.executor, this.pricesRepository, workerId, transientState);
  }

  private getActivePromises(): Promise<[string, boolean]>[] {
    return Array.from(this.activeWorkers.values()).map(x => x.promise);
  }

  private getNowMs(): bigint {
    return process.hrtime.bigint() / 1_000_000n;
  }

  private createWorkerInfo(stoppedWorkerId: string, failedAtMs?: bigint, transientState?: string[]): WorkerInfo {
    const worker = this.createWorker(stoppedWorkerId, transientState);
    return {
      failedAtMs,
      worker,
      promise: worker.run().then(() => [stoppedWorkerId, true], (error) => {
        this.logger.error(error, 'Worker stopped with error');
        return [stoppedWorkerId, false];
      })
    };
  }

  public async run(): Promise<void> {
    this.logger.info('Starting worker manager');
    if (this.activeWorkers.size !== 0) {
      throw new Error('Worker manager already started');
    }
    for (const workerConfig of this.config.oracleWorkers) {
      this.activeWorkers.set(workerConfig.id, this.createWorkerInfo(workerConfig.id));
    }
    let stoppedWorkerId: string;

    const thresholdMs = this.config.workerManager.sequentialFailsThresholdMs;

    while (true) {
      const [workerId, isSuccess] = await Promise.race(this.getActivePromises());
      stoppedWorkerId = workerId;

      if (this.stopRequested || isSuccess) {
        if (this.stopRequested) {
          this.logger.info('Stopping workers due to graceful shutdown');
        } else {
          this.logger.info(`Stopping workers due to successful exit of ${stoppedWorkerId} worker`);
        }
        break;
      } else {
        // here we assume that worker exited with error
        const workerInfo = this.activeWorkers.get(stoppedWorkerId)!;
        if (workerInfo.failedAtMs !== undefined && this.getNowMs() - workerInfo.failedAtMs < thresholdMs) {
          this.logger.info(`Stopping workers due to second failure of ${stoppedWorkerId} in less than ${thresholdMs} ms`);
          break;
        } else {
          // here worker failed for the first time or after threshold
          this.logger.info(`Waiting for ${this.config.workerManager.restartDelayMs} ms before restarting worker ${stoppedWorkerId}`);
          await sleep(this.config.workerManager.restartDelayMs);
          this.logger.info(`Restarting worker ${stoppedWorkerId}`);

          const transientState = this.activeWorkers.get(stoppedWorkerId)?.worker.getTransientState() ?? [];
          this.activeWorkers.set(stoppedWorkerId, this.createWorkerInfo(stoppedWorkerId, this.getNowMs(), transientState));
        }
      }
    }

    this.activeWorkers.delete(stoppedWorkerId);
    this.requestStop();

    for (let i = this.activeWorkers.size; i > 0; i--) {
      const [stoppedWorkerId] = await Promise.race(
        this.getActivePromises(),
      );
      this.activeWorkers.delete(stoppedWorkerId);
    }

    this.logger.info('Worker manager stopped');
  }
}