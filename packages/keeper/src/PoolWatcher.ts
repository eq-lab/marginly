import {
  MarginlyPoolParameters,
  PositionType,
  Fp96One,
  Fp96,
  MarginlyMode,
  Position,
  HeapNode,
  ContractDescription,
  RationalNumber,
} from '@marginly/common';
import { calcAccruedRateContext, calcBaseCoeffs, calcQuoteCoeffs } from '@marginly/common/marginly-accrued-rate';
import { Logger } from '@marginly/common/logger';
import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { LiquidationParams, PoolCoeffs } from './types';
import { KeeperConfig } from './types';

export class PoolWatcher {
  private readonly logger: Logger;
  public readonly pool: ethers.Contract;
  public readonly minProfitQuote: BigNumber;
  public readonly minProfitBase: BigNumber;

  public constructor(pool: ethers.Contract, minProfitQuote: BigNumber, minProfitBase: BigNumber, logger: Logger) {
    this.pool = pool;
    this.minProfitQuote = minProfitQuote;
    this.minProfitBase = minProfitBase;
    this.logger = logger;
  }

  public async findBadPositions(): Promise<LiquidationParams[]> {
    const mode: number = await this.pool.mode();
    if (mode != MarginlyMode.Regular) {
      this.logger.info(`Pool ${this.pool.address} in emergency mode. Liquidation not available`);
      return [];
    }

    const [
      basePrice,
      params,
      baseCollateralCoeff,
      baseDebtCoeff,
      quoteCollateralCoeff,
      quoteDebtCoeff,
      baseDelevCoeff,
      quoteDelevCoeff,
    ]: [Fp96, MarginlyPoolParameters, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] =
      await Promise.all([
        this.pool.getBasePrice(),
        this.pool.params(),
        this.pool.baseCollateralCoeff(),
        this.pool.baseDebtCoeff(),
        this.pool.quoteCollateralCoeff(),
        this.pool.quoteDebtCoeff(),
        this.pool.baseDelevCoeff(),
        this.pool.quoteDelevCoeff(),
      ]);

    const basePriceX96 = BigNumber.from(basePrice.inner);
    const currentCoeffs = await this.calcCoefficients(
      {
        baseCollateralCoeffX96: baseCollateralCoeff,
        baseDebtCoeffX96: baseDebtCoeff,
        quoteCollateralCoeffX96: quoteCollateralCoeff,
        quoteDebtCoeffX96: quoteDebtCoeff,
        quoteDelevCoeffX96: baseDelevCoeff,
        baseDelevCoeffX96: quoteDelevCoeff,
      },
      params
    );

    const maxLeverageX96 = params.maxLeverage.mul(Fp96One);
    const riskiestPositions = await Promise.all([this.getRiskiestShortPosition(), this.getRiskiestLongPosition()]);
    const result: LiquidationParams[] = [];

    for (const positionAddress of riskiestPositions) {
      if (positionAddress) {
        const liquidationParams = await this.checkPosition(positionAddress, basePriceX96, maxLeverage, currentCoeffs);
        if (liquidationParams) {
          result.push(liquidationParams);
        }
      }
    }

    return result;
  }

  private async getRiskiestShortPosition(): Promise<string | null> {
    const [success, node]: [boolean, HeapNode] = await this.pool.getHeapPosition(0, true);
    return success ? node.account : null;
  }

  private async getRiskiestLongPosition(): Promise<string | null> {
    const [success, node]: [boolean, HeapNode] = await this.pool.getHeapPosition(0, false);
    return success ? node.account : null;
  }

  private async checkPosition(
    positionAddress: string,
    basePriceX96: BigNumber,
    maxLeverageX96: BigNumber,
    poolCoeffs: PoolCoeffs
  ): Promise<LiquidationParams | null> {
    const position: Position = await this.pool.positions(positionAddress);

    if (position._type == PositionType.Short) {
      const debt = position.discountedBaseAmount.mul(poolCoeffs.baseDebtCoeffX96).div(Fp96One);
      const debtInQuote = debt.mul(basePriceX96).div(Fp96One);
      const collateral = position.discountedQuoteAmount
        .mul(poolCoeffs.quoteCollateralCoeffX96)
        .div(Fp96One)
        .sub(poolCoeffs.quoteDelevCoeffX96.mul(position.discountedBaseAmount).div(Fp96One));

      const leverageX96 = collateral.mul(Fp96One).div(collateral.sub(debtInQuote));
      const liquidationParams =
        leverageX96 > maxLeverageX96
          ? {
              position: positionAddress,
              asset: await this.pool.baseToken(),
              amount: debt,
              minProfit: this.minProfitBase,
              pool: this.pool.address,
            }
          : null;

      if (liquidationParams) {
        this.logger.debug(
          `Bad short position ${positionAddress} found: leverage:${leverageX96.div(Fp96One)} (max:${maxLeverageX96.div(
            Fp96One
          )}) amount:${debt} `
        );
      } else {
        this.logger.debug(
          `Short position ${positionAddress} checked: leverage:${leverageX96.div(Fp96One)} (max:${maxLeverageX96.div(
            Fp96One
          )})`
        );
      }

      return liquidationParams;
    } else if (position._type == PositionType.Long) {
      const debt = position.discountedQuoteAmount.mul(poolCoeffs.quoteDebtCoeffX96).div(Fp96One);
      const collateral = position.discountedBaseAmount
        .mul(poolCoeffs.baseCollateralCoeffX96)
        .div(Fp96One)
        .sub(poolCoeffs.baseDelevCoeffX96.mul(position.discountedQuoteAmount).div(Fp96One));
      const collateralInQuote = collateral.mul(basePriceX96).div(Fp96One);

      const leverageX96 = collateralInQuote.mul(Fp96One).div(collateralInQuote.sub(debt));
      const liquidationParams =
        leverageX96 > maxLeverageX96
          ? {
              position: positionAddress,
              asset: await this.pool.quoteToken(),
              amount: debt,
              minProfit: this.minProfitQuote,
              pool: this.pool.address,
            }
          : null;

      if (liquidationParams) {
        this.logger.debug(
          `Bad long position ${positionAddress} found: leverage:${leverageX96.div(Fp96One)} (max:${maxLeverageX96.div(
            Fp96One
          )}) amount:${debt} `
        );
      } else {
        this.logger.debug(
          `Long position ${positionAddress} checked: leverage:${leverageX96.div(Fp96One)} (max:${maxLeverageX96.div(
            Fp96One
          )})`
        );
      }

      return liquidationParams;
    } else {
      return null;
    }
  }

  private async calcCoefficients(coeffs: PoolCoeffs, params: MarginlyPoolParameters): Promise<PoolCoeffs> {
    const lastReinitTimestamp: number = await this.pool.lastReinitTimestampSeconds();
    const blockNumber = await this.pool.provider.getBlockNumber();
    const block = await this.pool.provider.getBlock(blockNumber);
    const currentTimestamp = block.timestamp;
    const secondsPassed = currentTimestamp - lastReinitTimestamp;
    this.logger.debug(
      `Current block: ${blockNumber}, timestamp: ${currentTimestamp}, seconds passed: ${secondsPassed}`
    );

    const result = {
      ...coeffs,
    };

    if (secondsPassed === 0) {
      return result;
    }

    const [
      discountedBaseDebt,
      discountedQuoteDebt,
      discountedBaseCollateral,
      discountedQuoteCollateral,
      systemLeverage,
    ]: [BigNumber, BigNumber, BigNumber, BigNumber, { shortX96: BigNumber; longX96: BigNumber }] = await Promise.all([
      this.pool.discountedBaseDebt(),
      this.pool.discountedQuoteDebt(),
      this.pool.discountedBaseCollateral(),
      this.pool.discountedQuoteCollateral(),
      this.pool.systemLeverage(),
    ]);

    const accruedRateContext = calcAccruedRateContext({
      interestRate: params.interestRate,
      fee: params.fee,
      secondsPassed,
    });

    if (!discountedBaseCollateral.isZero()) {
      const currentCoeffs = calcBaseCoeffs({
        ...coeffs,
        ...accruedRateContext,
        discountedBaseDebt,
        discountedBaseCollateral,
        discountedQuoteDebt,
        systemLeverageShortX96: systemLeverage.shortX96,
        secondsPassed,
      });

      result.baseCollateralCoeffX96 = currentCoeffs.baseCollateralCoeffX96;
      result.baseDelevCoeffX96 = currentCoeffs.baseDelevCoeffX96;
      result.baseDebtCoeffX96 = currentCoeffs.baseDebtCoeffX96;

      this.logger.debug(
        `Base coeffs:\n` +
          ` baseCollateralCoeffX96: ${currentCoeffs.baseCollateralCoeffX96}, old: ${coeffs.baseCollateralCoeffX96}\n` +
          ` baseDebtCoeffX96: ${currentCoeffs.baseDebtCoeffX96}, old: ${coeffs.baseDebtCoeffX96}\n` +
          ` baseDelevCoeffX96: ${currentCoeffs.baseDelevCoeffX96}, old: ${coeffs.baseDelevCoeffX96}\n`
      );
    }

    if (!discountedQuoteCollateral.isZero()) {
      const currentCoeffs = calcQuoteCoeffs({
        ...coeffs,
        ...accruedRateContext,
        discountedQuoteCollateral,
        discountedQuoteDebt,
        discountedBaseDebt,
        systemLevarageLongX96: systemLeverage.longX96,
        secondsPassed,
      });

      result.quoteCollateralCoeffX96 = currentCoeffs.quoteCollateralCoeffX96;
      result.quoteDelevCoeffX96 = currentCoeffs.quoteDelevCoeffX96;
      result.quoteDebtCoeffX96 = currentCoeffs.quoteDebtCoeffX96;

      this.logger.debug(
        `Quote coeffs:\n` +
          ` quoteCollateralCoeffX96: ${currentCoeffs.quoteCollateralCoeffX96}, old: ${coeffs.quoteCollateralCoeffX96}\n` +
          ` quoteDebtCoeffX96: ${currentCoeffs.quoteDebtCoeffX96}, old: ${coeffs.quoteDebtCoeffX96}\n` +
          ` quoteDelevCoeffX96: ${currentCoeffs.quoteDelevCoeffX96}, old: ${coeffs.quoteDelevCoeffX96}\n`
      );
    }

    return result;
  }
}

export async function createPoolWatchers(
  logger: Logger,
  config: KeeperConfig,
  tokenContractDescription: ContractDescription,
  marginlyPoolContractDescription: ContractDescription,
  provider?: ethers.providers.Provider
): Promise<PoolWatcher[]> {
  const getERC20Decimals = async (tokenAddress: string): Promise<number> => {
    const tokenContract = new ethers.Contract(tokenAddress, tokenContractDescription.abi, provider);
    return await tokenContract.decimals();
  };

  return Promise.all(
    config.marginlyPools.map(async (c) => {
      const marginlyPoolContract = new ethers.Contract(c.address, marginlyPoolContractDescription.abi, provider);
      const quoteDecimals: number = await getERC20Decimals(await marginlyPoolContract.quoteToken());
      const quoteOne = BigNumber.from(10).pow(quoteDecimals);
      const minProfitQuote = RationalNumber.parse(c.minProfitQuote).mul(quoteOne).toInteger();

      const baseDecimals: number = await getERC20Decimals(await marginlyPoolContract.baseToken());
      const baseOne = BigNumber.from(10).pow(baseDecimals);
      const minProfitBase = RationalNumber.parse(c.minProfitBase).mul(baseOne).toInteger();

      return new PoolWatcher(marginlyPoolContract, minProfitQuote, minProfitBase, logger);
    })
  );
}
