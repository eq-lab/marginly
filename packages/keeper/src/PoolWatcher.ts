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
    const [
      basePrice,
      params,
      mode,
      baseCollateralCoeff,
      baseDebtCoeff,
      quoteCollateralCoeff,
      quoteDebtCoeff,
      baseDelevCoeff,
      quoteDelevCoeff,
    ]: [Fp96, MarginlyPoolParameters, number, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] =
      await Promise.all([
        this.pool.getBasePrice(),
        this.pool.params(),
        this.pool.mode(),
        this.pool.baseCollateralCoeff(),
        this.pool.baseDebtCoeff(),
        this.pool.quoteCollateralCoeff(),
        this.pool.quoteDebtCoeff(),
        this.pool.baseDelevCoeff(),
        this.pool.quoteDelevCoeff(),
      ]);

    const basePriceX96 = BigNumber.from(basePrice.inner);

    const poolCoeffs: PoolCoeffs = {
      baseCollateralCoeffX96: baseCollateralCoeff,
      baseDebtCoeffX96: baseDebtCoeff,
      quoteCollateralCoeffX96: quoteCollateralCoeff,
      quoteDebtCoeffX96: quoteDebtCoeff,
      quoteDelevCoeffX96: baseDelevCoeff,
      baseDelevCoeffX96: quoteDelevCoeff,
    };

    if (mode != MarginlyMode.Regular) {
      this.logger.info(`Pool ${this.pool.address} in emergency mode. Liquidation not available`);
      return [];
    }

    const maxLeverage = params.maxLeverage;
    const riskiestPositions = await Promise.all([this.getRiskiestShortPosition(), this.getRiskiestLongPosition()]);

    const result: LiquidationParams[] = [];

    for (const positionAddress of riskiestPositions) {
      if (positionAddress) {
        const liquidationParams = await this.checkPosition(positionAddress, basePriceX96, maxLeverage, poolCoeffs);
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
    maxLeverage: BigNumber,
    poolCoeffs: PoolCoeffs
  ): Promise<LiquidationParams | null> {
    const position: Position = await this.pool.positions(positionAddress);

    if (position._type == PositionType.Short) {
      const debt = BigNumber.from(position.discountedBaseAmount).mul(poolCoeffs.baseDebtCoeffX96).div(Fp96One);
      const debtInQuote = debt.mul(basePriceX96).div(Fp96One);
      const collateral = BigNumber.from(position.discountedQuoteAmount)
        .mul(poolCoeffs.quoteCollateralCoeffX96)
        .div(Fp96One)
        .sub(poolCoeffs.quoteDelevCoeffX96.mul(position.discountedBaseAmount).div(Fp96One));

      const leverage = collateral.div(collateral.sub(debtInQuote));
      return leverage > maxLeverage
        ? {
            position: positionAddress,
            asset: await this.pool.baseToken(),
            amount: debt,
            minProfit: this.minProfitBase,
            pool: this.pool.address,
          }
        : null;
    } else if (position._type == PositionType.Long) {
      const debt = BigNumber.from(position.discountedQuoteAmount).mul(poolCoeffs.quoteDebtCoeffX96).div(Fp96One);
      const collateral = BigNumber.from(position.discountedBaseAmount)
        .mul(poolCoeffs.baseCollateralCoeffX96)
        .div(Fp96One)
        .sub(poolCoeffs.baseDelevCoeffX96.mul(position.discountedQuoteAmount).div(Fp96One));
      const collateralInQuote = collateral.mul(basePriceX96).div(Fp96One);

      const leverage = collateralInQuote.div(collateralInQuote.sub(debt));
      return leverage > maxLeverage
        ? {
            position: positionAddress,
            asset: await this.pool.quoteToken(),
            amount: debt,
            minProfit: this.minProfitQuote,
            pool: this.pool.address,
          }
        : null;
    } else {
      return null;
    }
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
