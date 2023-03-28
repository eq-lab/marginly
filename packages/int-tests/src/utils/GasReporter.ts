import { ContractReceipt, ContractTransaction } from 'ethers';
import { logger } from './logger';
import { promises as fsPromises, existsSync } from 'fs';
import { join } from 'path';

type GasUsage = {
  max: number;
  min: number;
  avg: number;
  count: number;
};

export class GasReporter {
  private gasUsageStatistics: { [key: string]: GasUsage } = {};
  private gasUsage: { [key: string]: [number, number][] } = {};

  constructor(private suiteName: string) {}

  public async saveGasUsage(
    txName: string,
    x: ContractReceipt | Promise<ContractReceipt> | ContractTransaction | Promise<ContractTransaction>
  ) {
    const resolved = await x;
    let txReceipt: ContractReceipt;
    if ('wait' in resolved) {
      txReceipt = await resolved.wait();
    } else if ('gasUsed' in resolved) {
      txReceipt = resolved;
    } else {
      throw Error('Uknown argument');
    }

    const gasUsed = txReceipt.gasUsed.toNumber();
    const blockNumber = txReceipt.blockNumber;

    logger.debug(`⛽ Gas used: ${txName}    ${gasUsed}`);

    const existedStatistic = this.gasUsageStatistics[txName];
    if (existedStatistic) {
      existedStatistic.max = existedStatistic.max < gasUsed ? gasUsed : existedStatistic.max;
      existedStatistic.min = existedStatistic.min > gasUsed ? gasUsed : existedStatistic.min;
      existedStatistic.avg = Math.floor(
        (existedStatistic.avg * existedStatistic.count + gasUsed) / (existedStatistic.count + 1)
      );
      existedStatistic.count++;
    } else {
      this.gasUsageStatistics[txName] = {
        max: gasUsed,
        min: gasUsed,
        avg: gasUsed,
        count: 1,
      };
    }

    if (!this.gasUsage[txName]) {
      this.gasUsage[txName] = [[blockNumber, gasUsed]];
    } else {
      this.gasUsage[txName].push([blockNumber, gasUsed]);
    }

    return txReceipt;
  }

  public reportToConsole() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const gasUsageStatistics = this.gasUsageStatistics;
    if (Object.keys(gasUsageStatistics).length > 0) {
      setTimeout(function () {
        console.log('Gas usage statistics');
        console.table(gasUsageStatistics);
      }, 10);
    }
  }

  async saveToFile() {
    const dir = join(__dirname, '../../', '__gas-usage__');

    if (!existsSync(dir)) {
      await fsPromises.mkdir(dir, { recursive: true });
    }

    for (const txName of Object.keys(this.gasUsage)) {
      const data = [`blockNumber,gasUsed\n`];
      for (const [blockNumber, gasUsed] of this.gasUsage[txName]) {
        data.push(`${blockNumber},${gasUsed}\n`);
      }
      const filename = `${this.suiteName}.${txName}.gas.csv`;

      await fsPromises.writeFile(join(dir, filename), data, {
        flag: 'w',
      });
    }
  }
}
