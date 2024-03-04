import { Logger } from '@marginly/common/logger';
import { Worker } from '@marginly/common/lifecycle';
import { using } from '@marginly/common/resource';
import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { formatEther, formatUnits } from 'ethers/lib/utils';
import { EthOptions, ContractDescriptions, LiquidationParams } from './types';
import { PoolWatcher } from './PoolWatcher';

export class MarginlyKeeperWorker implements Worker {
  private readonly logger: Logger;
  private readonly signer: ethers.Signer;
  private readonly keeperContract: ethers.Contract;
  private readonly contractDescriptions: ContractDescriptions;
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

      await using(this.logger.scope(`PoolWatcher ${poolWatcher.pool.address}`), async (logger) => {
        logger.info(`Check pool ${poolWatcher.pool.address}`);

        const liquidationParams = await poolWatcher.findBadPositions();
        logger.info(`Found ${liquidationParams.length} bad positions`);

        for (const liquidationParam of liquidationParams) {
          if (this.stopRequested) {
            return;
          }

          //Working in reinit mode
          await this.callReinit(logger, liquidationParam);

          // if (await this.isAvailableForBorrow(logger, liquidationParam.asset)) {
          //   await this.tryLiquidateWithFlashloan(logger, liquidationParam);
          // } else {
          //   await this.callReinit(logger, liquidationParam);
          // }
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

  private async callReinit(logger: Logger, liquidationParam: LiquidationParams): Promise<void> {
    logger.info(`Aave flashLoan not available, asset: ${liquidationParam.asset}`);

    try {
      logger.info(`Sending tx to reinit`);
      const marginlyPoolContract = new ethers.Contract(
        liquidationParam.pool,
        this.contractDescriptions.marginlyPool.abi,
        this.signer.provider
      );

      const price = (await marginlyPoolContract.getBasePrice()).inner;
      const reinitCallType = 7;
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
      const uniswapV3Swapdata = 0;

      const tx = await marginlyPoolContract
        .connect(this.signer)
        .execute(reinitCallType, 0, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata);
      const txReceipt = await tx.wait();
    } catch (error) {
      logger.error(`Error while sending reinit tx: ${error}`);
    }
  }

  private async tryLiquidateWithFlashloan(logger: Logger, liquidationParam: LiquidationParams): Promise<void> {
    const refferalCode = 0;

    const debtTokenContract = new ethers.Contract(
      liquidationParam.asset,
      this.contractDescriptions.token.abi,
      this.signer.provider
    );

    try {
      logger.info(
        `Sending tx to liquidate position with params` +
          ` asset:${liquidationParam.asset}, amount:${liquidationParam.amount}, pool:${liquidationParam.pool}, position:${liquidationParam.position}, minProfit:${liquidationParam.minProfit}`
      );

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
        logger.info(`Position ${liquidationParam.position} liquidated`);
      });
    } catch (error) {
      logger.error(`Error while sending flashLoan tx: ${error}`);
    }
  }

  private async isAvailableForBorrow(logger: Logger, tokenAddress: string): Promise<boolean> {
    const aavePoolAddress = await this.keeperContract.POOL();
    const aavePoolContract = new ethers.Contract(
      aavePoolAddress,
      this.contractDescriptions.aavePool.abi,
      this.signer.provider
    );
    const configuration = await aavePoolContract.getConfiguration(tokenAddress);
    logger.info(`Aave configuration for asset: ${tokenAddress} is ${configuration}`);

    const isAvailable = configuration != '0';
    return isAvailable;
  }
}
