import { Logger } from '@marginly/common/logger';
import { Worker } from '@marginly/common/lifecycle';
import { using } from '@marginly/common/resource';
import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { formatEther, formatUnits, parseUnits } from 'ethers/lib/utils';
import { EthOptions, ContractDescriptions, LiquidationParams, PoolPositionLiquidationConfig } from './types';
import { PoolWatcher } from './PoolWatcher';
import { encodeLiquidationParams } from '@marginly/common';

export class MarginlyKeeperWorker implements Worker {
  private readonly logger: Logger;
  private readonly signer: ethers.Signer;
  private readonly keeperAaveContract: ethers.Contract;
  private readonly keeperUniswapV3Contract: ethers.Contract;
  private readonly contractDescriptions: ContractDescriptions;
  private readonly poolWatchers: PoolWatcher[];
  private readonly ethOptions: EthOptions;

  private stopRequested: boolean;

  constructor(
    signer: ethers.Signer,
    contractDescriptions: ContractDescriptions,
    poolWatchers: PoolWatcher[],
    keeperAaveContract: ethers.Contract,
    keeperUniswapV3Contract: ethers.Contract,
    ethOptions: EthOptions,
    logger: Logger
  ) {
    this.signer = signer;
    this.keeperAaveContract = keeperAaveContract;
    this.keeperUniswapV3Contract = keeperUniswapV3Contract;
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

          if (liquidationParam.config.keeperType == 'aave') {
            await this.tryLiquidateWithAave(logger, liquidationParam);
          } else if (liquidationParam.config.keeperType === 'uniswapV3') {
            await this.tryLiquidateWithUniswapV3(logger, liquidationParam);
          } else {
            throw new Error(`Configuration error. Unknown keeperType: ${liquidationParam.config.keeperType}`);
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

  private async getMinProfit(liquidationParam: LiquidationParams, asset: ethers.Contract): Promise<BigNumber> {
    const decimals: number = await asset.decimals();
    const rawMinProfit = liquidationParam.isQuoteAsset
      ? liquidationParam.config.minProfitQuote
      : liquidationParam.config.minProfitBase;
    return parseUnits(rawMinProfit, decimals);
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
      const uniswapV3Swapdata = 0;

      const tx = await marginlyPoolContract
        .connect(this.signer)
        .execute(reinitCallType, 0, 0, price, false, ethers.constants.AddressZero, uniswapV3Swapdata);
      const txReceipt = await tx.wait();
    } catch (error) {
      logger.error(`Error while sending reinit tx: ${error}`);
    }
  }

  private async tryLiquidateWithAave(logger: Logger, liquidationParam: LiquidationParams): Promise<void> {
    if (!(await this.isAvailableForBorrow(logger, liquidationParam.asset))) {
      this.callReinit(logger, liquidationParam);
      return;
    }

    const refferalCode = 0;

    const debtTokenContract = new ethers.Contract(
      liquidationParam.asset,
      this.contractDescriptions.token.abi,
      this.signer.provider
    );
    const minProfit = await this.getMinProfit(liquidationParam, debtTokenContract);

    try {
      logger.info(
        `Sending tx to liquidate position with params` +
          ` asset:${liquidationParam.asset}, amount:${liquidationParam.amount}, pool:${liquidationParam.pool}, position:${liquidationParam.position}, minProfit:${minProfit}`
      );

      await this.logBalanceChange(logger, debtTokenContract, async () => {
        const tx = await this.keeperAaveContract
          .connect(this.signer)
          .flashLoan(
            liquidationParam.asset,
            liquidationParam.amount,
            refferalCode,
            liquidationParam.pool,
            liquidationParam.position,
            minProfit,
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
    const aavePoolAddress = await this.keeperAaveContract.POOL();
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

  private async tryLiquidateWithUniswapV3(logger: Logger, liquidationParams: LiquidationParams): Promise<void> {
    const config = liquidationParams.config;

    if (!config.flashLoanPools) {
      throw new Error(`Configuration error: flashLoanPools (UniswapV3 pool addresses) not set in configuration.`);
    }

    if (!config.swapCallData) {
      throw new Error(`Configuration error: swapCallData not set.`);
    }

    let uniswapPool: ethers.Contract | undefined;
    let amount0 = BigNumber.from(0);
    let amount1 = BigNumber.from(0);
    for (const uniswapPoolAddress of config.flashLoanPools) {
      const contract = new ethers.Contract(uniswapPoolAddress, this.contractDescriptions.uniswapPool.abi, this.signer);

      const [token0, token1]: [string, string] = await Promise.all([contract.token0(), contract.token1()]);

      if (token0.toLowerCase() === liquidationParams.asset.toLowerCase()) {
        uniswapPool = contract;
        amount0 = liquidationParams.amount;

        break;
      } else if (token1.toLowerCase() === liquidationParams.asset.toLowerCase()) {
        uniswapPool = contract;
        amount1 = liquidationParams.amount;

        break;
      }
    }

    if (!uniswapPool) {
      logger.info(`No suitable uniswapV3Pool found for asset ${liquidationParams.asset}. Call reinit`);
      this.callReinit(logger, liquidationParams);

      return;
    }

    const debtTokenContract = new ethers.Contract(
      liquidationParams.asset,
      this.contractDescriptions.token.abi,
      this.signer.provider
    );

    const minProfit = await this.getMinProfit(liquidationParams, debtTokenContract);

    const encodedParams = encodeLiquidationParams(
      liquidationParams.asset,
      liquidationParams.amount,
      liquidationParams.pool,
      liquidationParams.position,
      await this.signer.getAddress(),
      uniswapPool.address,
      minProfit,
      BigNumber.from(liquidationParams.config.swapCallData)
    );

    try {
      logger.info(
        `Sending tx to liquidate position with params` +
          ` asset:${liquidationParams.asset}, amount:${liquidationParams.amount}, pool:${liquidationParams.pool}, position:${liquidationParams.position}, minProfit:${minProfit}, uniswapPool:${uniswapPool.address}`
      );

      await this.logBalanceChange(logger, debtTokenContract, async () => {
        const tx = await this.keeperUniswapV3Contract
          .connect(this.signer)
          .liquidatePosition(uniswapPool!.address, amount0, amount1, encodedParams, this.ethOptions);
        const txReceipt = await tx.wait();
        logger.info(`Position ${liquidationParams.position} liquidated`);
      });
    } catch (error) {
      logger.error(`Error while sending flashLoan tx: ${error}`);
    }
  }
}
