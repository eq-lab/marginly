import { Logger } from '@marginly/common/logger';
import { Worker } from '@marginly/common/lifecycle';
import { using } from '@marginly/common/resource';
import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { formatEther, formatUnits } from 'ethers/lib/utils';
import { EthOptions, ContractDescriptions } from './types';
import { PoolWatcher } from './PoolWatcher';

export class MarginlyKeeperWorker implements Worker {
  private readonly logger: Logger;
  private readonly signer: ethers.Signer;
  private readonly keeperContract: ethers.Contract;
  private readonly contractDescriptions: any;
  private readonly poolWatchers: PoolWatcher[];
  private readonly ethOptions: EthOptions;

  private stopRequested: boolean;

  constructor(
    signer: ethers.Signer,
    contractDescriptions: ContractDescriptions,
    poolWatchers: PoolWatcher[],
    keeperContract: ethers.Contract,
    ethOptions: EthOptions,
    logger: Logger
  ) {
    this.signer = signer;
    this.keeperContract = keeperContract;
    this.logger = logger;
    this.contractDescriptions = contractDescriptions;
    this.poolWatchers = poolWatchers;
    this.ethOptions = ethOptions;

    this.stopRequested = false;
  }

  requestStop(): void {
    this.stopRequested = true;
  }

  public isStopRequested(): boolean {
    return this.stopRequested;
  }

  async run(): Promise<void> {
    for (const poolWatcher of this.poolWatchers) {
      if (this.stopRequested) {
        return;
      }

      const scopeName = `PoolWatcher ${poolWatcher.pool.address}`;
      await using(this.logger.scope(scopeName), async (logger) => {
        logger.debug(`Check pool ${poolWatcher.pool.address}`);

        const liquidationParams = await poolWatcher.findBadPositions();
        logger.debug(`Found ${liquidationParams.length} bad positions`);

        for (const liquidationParam of liquidationParams) {
          if (this.stopRequested) {
            return;
          }
          const refferalCode = 0;

          const debtTokenContract = new ethers.Contract(
            liquidationParam.asset,
            this.contractDescriptions.token.abi,
            this.signer.provider
          );

          try {
            logger.info(`Sending tx to liquidate position with params`, liquidationParam);

            await this.logBalanceChange(logger, debtTokenContract, async () => {
              const tx = await this.keeperContract
                .connect(this.signer)
                .flashLoan(
                  liquidationParam.asset,
                  liquidationParam.amount,
                  refferalCode,
                  liquidationParam.pool,
                  liquidationParam.position,
                  liquidationParam.minProfit,
                  this.ethOptions
                );
              const txReceipt = await tx.wait();
              logger.info(`Tx receipt is ${txReceipt}`);
            });
          } catch (error) {
            logger.error(`Error while sending tx: ${error}`);
          }
        }
      });
    }
  }

  private async logBalanceChange(logger: Logger, token: ethers.Contract, action: () => Promise<void>): Promise<void> {
    const signerAddress = await this.signer.getAddress();
    const [, balanceBefore, ethBalanceBefore] = await Promise.all([
      ,
      token.balanceOf(signerAddress),
      this.signer.getBalance(),
    ]);

    await action();

    const [balanceAfter, symbol, decimals, ethBalanceAfter]: [BigNumber, string, number, BigNumber] = await Promise.all(
      [token.balanceOf(signerAddress), token.symbol(), token.decimals(), this.signer.getBalance()]
    );

    logger.info(
      `Liquidation profit = ${balanceAfter} - ${balanceBefore} = ${formatUnits(
        balanceAfter.sub(balanceBefore),
        decimals
      )} ${symbol}. Tx fee = ${ethBalanceBefore} - ${ethBalanceAfter} = ${formatEther(
        ethBalanceBefore.sub(ethBalanceAfter)
      )} ETH`
    );
  }
}
