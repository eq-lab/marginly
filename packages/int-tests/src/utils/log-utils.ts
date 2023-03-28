import { BigNumber } from 'ethers';
import { formatUnits } from 'ethers/lib/utils';
import bn from 'bignumber.js';
import { FP96, toHumanString } from '../utils/fixed-point';
import { logger } from '../utils/logger';
import { SystemUnderTest } from '../suites';

export async function showSystemAggregates(sut: SystemUnderTest) {
  const { marginlyPool, marginlyFactory, accounts, usdc, weth } = sut;
  const discountedBaseCollateral = BigNumber.from(await marginlyPool.discountedBaseCollateral());
  const discountedBaseDebt = BigNumber.from(await marginlyPool.discountedBaseDebt());
  const discountedQuoteCollateral = BigNumber.from(await marginlyPool.discountedQuoteCollateral());
  const discountedQuoteDebt = BigNumber.from(await marginlyPool.discountedQuoteDebt());

  const usdcBalance = BigNumber.from(await usdc.balanceOf(marginlyPool.address));
  const wethBalance = BigNumber.from(await weth.balanceOf(marginlyPool.address));

  const lastReinit = await marginlyPool.lastReinitTimestampSeconds();

  const baseCollateralCoeff = BigNumber.from(await marginlyPool.baseCollateralCoeff());
  const baseDebtCoeff = BigNumber.from(await marginlyPool.baseDebtCoeff());
  const quoteCollateralCoeff = BigNumber.from(await marginlyPool.quoteCollateralCoeff());
  const quoteDebtCoeff = BigNumber.from(await marginlyPool.quoteDebtCoeff());

  const systemLeverage = await marginlyPool.systemLeverage();
  const shortX96 = BigNumber.from(systemLeverage.shortX96);
  const longX96 = BigNumber.from(systemLeverage.longX96);
  const basePriceX96 = BigNumber.from((await marginlyPool.getBasePrice()).inner).mul(10 ** 12);

  // calc aggregates
  const realQuoteCollateral = quoteCollateralCoeff.mul(discountedQuoteCollateral).div(FP96.one);
  const realQuoteDebt = quoteDebtCoeff.mul(discountedQuoteDebt).div(FP96.one);
  const realBaseCollateral = baseCollateralCoeff.mul(discountedBaseCollateral).div(FP96.one);
  const realBaseDebt = baseDebtCoeff.mul(discountedBaseDebt).div(FP96.one);

  const feeBalance = await usdc.balanceOf(await marginlyFactory.feeHolder());

  //totalCollateral - totalDebt
  const systemBalance = realBaseCollateral
    .sub(realBaseDebt)
    .mul(basePriceX96.div(10 ** 12))
    .div(FP96.one)
    .add(realQuoteCollateral)
    .sub(realQuoteDebt);

  logger.info(`📜 Marginly state: `);
  logger.info(`     discountedBaseCollateral = ${formatUnits(discountedBaseCollateral, 18)}  WETH`);
  logger.info(`     discountedBaseDebt       = ${formatUnits(discountedBaseDebt, 18)} WETH`);
  logger.info(`     discoutedQuoteCollateral = ${formatUnits(discountedQuoteCollateral, 6)} USDC`);
  logger.info(`     discoutedQuoteDebt       = ${formatUnits(discountedQuoteDebt, 6)} USDC`);
  logger.info(` `);
  logger.info(`     realBaseCollateral       = ${formatUnits(realBaseCollateral, 18)} WETH`);
  logger.info(`     realBaseDebt             = ${formatUnits(realBaseDebt, 18)} WETH`);
  logger.info(`     realQuoteCollateral      = ${formatUnits(realQuoteCollateral, 6)} USDC`);
  logger.info(`     realQuoteDebt            = ${formatUnits(realQuoteDebt, 6)} USDC`);
  logger.info(`     systemBalance            = ${formatUnits(systemBalance, 6)} USDC`);
  logger.info(` `);
  logger.info(`     USDC balance             = ${formatUnits(usdcBalance, 6)} USDC`);
  logger.info(`     WETH balance             = ${formatUnits(wethBalance, 18)} WETH`);
  logger.info(` `);
  logger.info(`     baseCollateralCoeff      = ${toHumanString(baseCollateralCoeff)}`);
  logger.info(`     baseDebtCoeff            = ${toHumanString(baseDebtCoeff)}`);
  logger.info(`     quoteCollateralCoeff     = ${toHumanString(quoteCollateralCoeff)}`);
  logger.info(`     quoteDebtCoeff           = ${toHumanString(quoteDebtCoeff)}`);
  logger.info(` `);
  logger.info(`     lastReinit               = ${lastReinit}`);
  logger.info(`     Leverage.short           = ${toHumanString(shortX96)}`);
  logger.info(`     Leverage.long            = ${toHumanString(longX96)}`);
  logger.info(`     basePrice                = ${toHumanString(basePriceX96)} USDC`);
  logger.info(` `);
  logger.info(`     feeBalance               = ${formatUnits(feeBalance, 6)} USDC`);
  logger.info(` `);
  logger.info(`  Positions:`);
  for (let i = 0; i < 4; i++) {
    const position = await marginlyPool.positions(accounts[i].address);
    const type = BigNumber.from(position._type).toNumber();
    let typeStr;
    if (type == 0) {
      typeStr = 'Uninitialized';
    } else if (type == 1) {
      typeStr = 'Lend';
    } else if (type == 2) {
      typeStr = 'Short (Base in debt)';
    } else if (type == 3) {
      typeStr = 'Long (Quote in debt)';
    }

    const discountedBaseAmount = BigNumber.from(position.discountedBaseAmount);
    const discountedQuoteAmount = BigNumber.from(position.discountedQuoteAmount);
    let realBaseAmount = discountedBaseAmount.mul(baseCollateralCoeff).div(FP96.one);
    let realQuoteAmount = discountedQuoteAmount.mul(quoteCollateralCoeff).div(FP96.one);
    let leverage = bn(1);
    if (type === 2) {
      // Short
      realBaseAmount = discountedBaseAmount.mul(baseDebtCoeff).div(FP96.one);
      const collateral = realQuoteAmount;
      const debt = basePriceX96
        .div(10 ** 12)
        .mul(realBaseAmount)
        .div(FP96.one);
      leverage = bn(collateral.toString()).div(collateral.sub(debt).toString());
    } else if (type === 3) {
      //Long
      realQuoteAmount = discountedQuoteAmount.mul(quoteDebtCoeff).div(FP96.one);
      const collateral = basePriceX96
        .div(10 ** 12)
        .mul(realBaseAmount)
        .div(FP96.one);
      const debt = realQuoteAmount;
      leverage = bn(collateral.toString()).div(collateral.sub(debt).toString());
    }

    logger.info(` `);
    logger.info(`   ${accounts[i].address}`);
    logger.info(`   ${typeStr}`);
    logger.info(`   discountedBaseAmount       = ${formatUnits(discountedBaseAmount, 18)} WETH`);
    logger.info(`   discountedQuoteAmount      = ${formatUnits(discountedQuoteAmount, 6)} USDC`);
    logger.info(`   realBaseAmount             = ${formatUnits(realBaseAmount, 18)} WETH`);
    logger.info(`   realQuoteAmount            = ${formatUnits(realQuoteAmount, 6)} USDC`);
    logger.info(`   leverage                   = ${leverage.toString()}`);
  }
}
