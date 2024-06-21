import { Logger } from '@marginly/common/logger';
import { Worker } from '@marginly/common/lifecycle';
import { using } from '@marginly/common/resource';
import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { formatEther, formatUnits, parseUnits } from 'ethers/lib/utils';
import {
  EthOptions,
  ContractDescriptions,
  LiquidationParams,
  PoolPositionLiquidationConfig,
  isReinitLiquidationConfig,
  isAaveLiquidationConfig,
  isUniswapV3LiquidationConfig,
  UniswapV3LiquidationConfig,
  AlgebraLiquidationConfig,
  isAlgebraLiquidationConfig,
  isBalancerLiquidationConfig,
  KeeperType,
  BalancerLiquidationConfig,
  AaveLiquidationConfig,
} from './types';
import { PoolWatcher } from './PoolWatcher';
import {
  encodeLiquidationParamsAave,
  encodeLiquidationParams,
  encodeLiquidationParamsBalancer,
} from '@marginly/common';

export class MarginlyKeeperWorker implements Worker {
  private readonly logger: Logger;
  private readonly signer: ethers.Signer;
  private readonly keepers: Map<KeeperType, ethers.Contract>;
  private readonly contractDescriptions: ContractDescriptions;
  private readonly poolWatchers: PoolWatcher[];
  private readonly ethOptions: EthOptions;

  private stopRequested: boolean;

  constructor(
    signer: ethers.Signer,
    contractDescriptions: ContractDescriptions,
    poolWatchers: PoolWatcher[],
    keepers: Map<KeeperType, ethers.Contract>,
    ethOptions: EthOptions,
    logger: Logger
  ) {
    this.signer = signer;
    this.keepers = keepers;
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

          const liqConfig = liquidationParam.config;

          if (isReinitLiquidationConfig(liqConfig)) {
            await this.callReinit(logger, liquidationParam);
          } else if (isAaveLiquidationConfig(liqConfig)) {
            await this.tryLiquidateWithAave(logger, liqConfig, liquidationParam);
          } else if (isUniswapV3LiquidationConfig(liqConfig)) {
            await this.tryLiquidateWithUniswapV3(logger, liqConfig, liquidationParam);
          } else if (isAlgebraLiquidationConfig(liqConfig)) {
            await this.tryLiquidateWithAlgebra(logger, liqConfig, liquidationParam);
          } else if (isBalancerLiquidationConfig(liqConfig)) {
            await this.tryLiquidateWithBalancer(logger, liqConfig, liquidationParam);
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

  private async tryLiquidateWithAave(
    logger: Logger,
    config: AaveLiquidationConfig,
    liquidationParam: LiquidationParams
  ): Promise<void> {
    if (!(await this.isAvailableForBorrow(logger, liquidationParam.asset))) {
      this.callReinit(logger, liquidationParam);
      return;
    }

    const debtTokenContract = new ethers.Contract(
      liquidationParam.asset,
      this.contractDescriptions.token.abi,
      this.signer.provider
    );
    const minProfit = await this.getMinProfit(liquidationParam, debtTokenContract);
    const encodedParams = encodeLiquidationParamsAave(
      liquidationParam.pool,
      liquidationParam.position,
      await this.signer.getAddress(),
      minProfit,
      BigNumber.from(config.swapCallData)
    );

    try {
      logger.info(
        `Sending tx to liquidate position with params` +
          ` asset:${liquidationParam.asset}, amount:${liquidationParam.amount}, pool:${liquidationParam.pool}, position:${liquidationParam.position}, minProfit:${minProfit}`
      );

      const keeper = this.keepers.get('aave')!;

      await this.logBalanceChange(logger, debtTokenContract, async () => {
        const tx = await keeper
          .connect(this.signer)
          .liquidatePosition(liquidationParam.asset, liquidationParam.amount, encodedParams, this.ethOptions);
        logger.info(`Position ${liquidationParam.position} liquidated`);
      });
    } catch (error) {
      logger.error(`Error while sending flashLoan tx: ${error}`);
    }
  }

  private async isAvailableForBorrow(logger: Logger, tokenAddress: string): Promise<boolean> {
    const aavePoolAddress = await this.keepers.get('aave')!.POOL();
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

  private async tryLiquidateWithUniswapV3(
    logger: Logger,
    config: UniswapV3LiquidationConfig,
    liquidationParams: LiquidationParams
  ): Promise<void> {
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
      BigNumber.from(config.swapCallData)
    );

    try {
      logger.info(
        `Sending tx to liquidate position with params` +
          ` asset:${liquidationParams.asset}, amount:${liquidationParams.amount}, pool:${liquidationParams.pool}, position:${liquidationParams.position}, minProfit:${minProfit}, uniswapPool:${uniswapPool.address}`
      );

      await this.logBalanceChange(logger, debtTokenContract, async () => {
        const tx = await this.keepers
          .get('uniswapV3')!
          .connect(this.signer)
          .liquidatePosition(uniswapPool!.address, amount0, amount1, encodedParams, this.ethOptions);
        const txReceipt = await tx.wait();
        logger.info(`Position ${liquidationParams.position} liquidated`);
      });
    } catch (error) {
      logger.error(`Error while sending flashLoan tx: ${error}`);
    }
  }

  private async tryLiquidateWithAlgebra(
    logger: Logger,
    config: AlgebraLiquidationConfig,
    liquidationParams: LiquidationParams
  ): Promise<void> {
    let algebraPool: ethers.Contract | undefined;
    let amount0 = BigNumber.from(0);
    let amount1 = BigNumber.from(0);
    for (const uniswapPoolAddress of config.flashLoanPools) {
      const contract = new ethers.Contract(uniswapPoolAddress, this.contractDescriptions.uniswapPool.abi, this.signer);

      const [token0, token1]: [string, string] = await Promise.all([contract.token0(), contract.token1()]);

      if (token0.toLowerCase() === liquidationParams.asset.toLowerCase()) {
        algebraPool = contract;
        amount0 = liquidationParams.amount;

        break;
      } else if (token1.toLowerCase() === liquidationParams.asset.toLowerCase()) {
        algebraPool = contract;
        amount1 = liquidationParams.amount;

        break;
      }
    }

    if (!algebraPool) {
      logger.info(`No suitable flashloanPool found for asset ${liquidationParams.asset}. Call reinit`);
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
      algebraPool.address,
      minProfit,
      BigNumber.from(config.swapCallData)
    );

    try {
      logger.info(
        `Sending tx to liquidate position with params` +
          ` asset:${liquidationParams.asset}, amount:${liquidationParams.amount}, pool:${liquidationParams.pool}, position:${liquidationParams.position}, minProfit:${minProfit}, uniswapPool:${algebraPool.address}`
      );

      const keeper = this.keepers.get('algebra')!;

      const tx = await keeper
        .connect(this.signer)
        .liquidatePosition(algebraPool!.address, amount0, amount1, encodedParams, this.ethOptions);
      await tx.wait();

      logger.info(`Position ${liquidationParams.position} liquidated`);
    } catch (error) {
      logger.error(`Error while sending flashLoan tx: ${error}`);
    }
  }

  private async tryLiquidateWithBalancer(
    logger: Logger,
    config: BalancerLiquidationConfig,
    liquidationParams: LiquidationParams
  ): Promise<void> {
    const debtTokenContract = new ethers.Contract(
      liquidationParams.asset,
      this.contractDescriptions.token.abi,
      this.signer.provider
    );

    const minProfit = await this.getMinProfit(liquidationParams, debtTokenContract);

    const encodedParams = encodeLiquidationParamsBalancer(
      liquidationParams.pool,
      liquidationParams.position,
      await this.signer.getAddress(),
      minProfit,
      BigNumber.from(config.swapCallData)
    );

    try {
      logger.info(
        `Sending tx to liquidate position with params` +
          ` asset:${liquidationParams.asset}, amount:${liquidationParams.amount}, pool:${liquidationParams.pool}, position:${liquidationParams.position}, minProfit:${minProfit}`
      );

      const keeper = this.keepers.get('balancer')!;

      const tx = await keeper
        .connect(this.signer)
        .liquidatePosition(liquidationParams.asset, liquidationParams.amount, encodedParams, this.ethOptions);
      await tx.wait();

      logger.info(`Position ${liquidationParams.position} liquidated`);
    } catch (error) {
      logger.error(`Error while sending flashLoan tx: ${error}`);
    }
  }
}
