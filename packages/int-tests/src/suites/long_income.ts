import assert = require('assert');
import { BigNumber } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { logger } from '../utils/logger';
import { decodeSwapEvent } from '../utils/chain-ops';
import { FP96, toHumanString } from '../utils/fixed-point';
import { changeWethPrice } from '../utils/uniswap-ops';

export async function longIncome(sut: SystemUnderTest) {
  logger.info(`Starting longIncome test suite`);
  const { marginlyPool, treasury, usdc, weth, accounts, provider, uniswap, gasReporter } = sut;

  const numberOfLenders = 2;
  const lenders = accounts.slice(0, numberOfLenders);
  const quoteAmount = parseUnits('1000000', 6); // 1_000_000 USDC

  logger.info(`Deposit quote and base`);
  for (let i = 0; i < lenders.length; i++) {
    await (await usdc.connect(treasury).transfer(lenders[i].address, quoteAmount)).wait();
    await (await usdc.connect(lenders[i]).approve(marginlyPool.address, quoteAmount)).wait();

    await gasReporter.saveGasUsage(
      'depositQuote',
      marginlyPool.connect(lenders[i]).depositQuote(quoteAmount,0, { gasLimit: 500_000 })
    );
  }

  const wethPriceX96 = BigNumber.from((await marginlyPool.getBasePrice()).inner).mul(10n ** 12n);

  logger.info(`Weth price = ${toHumanString(wethPriceX96)}`);

  const borrower = accounts[numberOfLenders];
  const initialBorrBaseBalance = parseUnits('1', 18); // 1 WETH
  logger.info(`borrower initial deposit: ${formatUnits(initialBorrBaseBalance, 18)} WETH`);

  await (await weth.connect(treasury).transfer(borrower.address, initialBorrBaseBalance)).wait();
  await (await weth.connect(borrower).approve(marginlyPool.address, initialBorrBaseBalance)).wait();

  await gasReporter.saveGasUsage(
    'depositBase',
    marginlyPool.connect(borrower).depositBase(initialBorrBaseBalance, 0,{ gasLimit: 500_000 })
  );

  // we are checking nothing here since it's basically long test with extra step
  const longAmount = parseUnits('5', 18);
  logger.info(`Open ${formatUnits(longAmount, 18)} WETH long position`);

  await gasReporter.saveGasUsage('long', marginlyPool.connect(borrower).long(longAmount, { gasLimit: 1_500_000 }));

  logger.info(`Increasing WETH price by ~10%`);
  await changeWethPrice(treasury, provider.provider, sut, wethPriceX96.mul(11).div(10).div(FP96.one));

  const shiftInDays = 10;
  logger.info(`Shift date by ${shiftInDays} days`);
  // shift time
  const numOfSeconds = shiftInDays * 24 * 60 * 60;
  await provider.mineAtTimestamp(+BigNumber.from(await marginlyPool.lastReinitTimestampSeconds()) + numOfSeconds);

  logger.info(`reinit`);
  const reinitReceipt = await gasReporter.saveGasUsage(
    'reinit',
    await marginlyPool.connect(treasury).reinit({ gasLimit: 1_000_000 })
  );
  logger.info(`reinit executed`);
  const marginCallEvent = reinitReceipt.events?.find((e) => e.event == 'EnactMarginCall');
  if (marginCallEvent) {
    const error = `MC happened, try reducing time shift`;
    logger.error(error);
    throw new Error(error);
  }

  const positionBefore = await marginlyPool.positions(borrower.address);
  const positionDiscountedBaseAmountBefore = BigNumber.from(positionBefore.discountedBaseAmount);
  const discountedBaseCollBefore = BigNumber.from(await marginlyPool.discountedBaseCollateral());

  logger.info(`Closing position`);
  const closePosReceipt = await gasReporter.saveGasUsage(
    'closePosition',
    await marginlyPool.connect(borrower).closePosition({ gasLimit: 1_000_000 })
  );
  const closePosSwapEvent = decodeSwapEvent(closePosReceipt, uniswap.address);
  const swapAmount = closePosSwapEvent.amount1;
  logger.info(`swapAmount: ${formatUnits(swapAmount, 18)} WETH`);
  logger.info(`discountedBaseCollateral: ${formatUnits(await marginlyPool.discountedBaseCollateral(), 18)} WETH`);
  logger.info(`discountedQuoteDebt: ${formatUnits(await marginlyPool.discountedQuoteDebt(), 6)} USDC`);

  const collCoeff = BigNumber.from(await marginlyPool.baseCollateralCoeff());
  const positionAfter = await marginlyPool.positions(borrower.address);
  const positionDiscountedBaseAmountAfter = BigNumber.from(positionAfter.discountedBaseAmount);
  const expectedPosDiscountedBaseAmount = positionDiscountedBaseAmountBefore.sub(
    swapAmount.mul(FP96.one).div(collCoeff)
  );

  logger.info(`position.discountedBaseAmount: ${formatUnits(positionAfter.discountedBaseAmount, 18)} ETH`);
  assert.deepEqual(expectedPosDiscountedBaseAmount, positionDiscountedBaseAmountAfter, 'pos.discountedBaseAmount');

  const positionRealBaseAmount = BigNumber.from(positionAfter.discountedBaseAmount).mul(collCoeff).div(FP96.one);
  logger.info(`position real base amount: ${formatUnits(positionRealBaseAmount, 18)} ETH`);

  const positionDiscountedQuoteAmountAfter = +BigNumber.from(positionAfter.discountedQuoteAmount);
  assert.deepEqual(0, positionDiscountedQuoteAmountAfter, 'pos.discountedQuoteAmount');

  const discountedBaseCollAfter = BigNumber.from(await marginlyPool.discountedBaseCollateral());
  const expectedDiscountedBaseColl = discountedBaseCollBefore.sub(swapAmount.mul(FP96.one).div(collCoeff));
  assert.deepEqual(expectedDiscountedBaseColl, discountedBaseCollAfter, 'discountedBaseCollateral');

  const discountedQuoteDebt = +BigNumber.from(await marginlyPool.discountedQuoteDebt());
  assert.deepEqual(discountedQuoteDebt, 0, 'discountedQuoteDebt');

  const moneyBefore = +formatUnits(initialBorrBaseBalance.mul(wethPriceX96).div(FP96.one), 18);
  const price = BigNumber.from((await marginlyPool.getBasePrice()).inner);
  const moneyAfter = +formatUnits(positionRealBaseAmount.mul(price).div(FP96.one), 6);
  logger.info(`WETH initial deposit * initial price:   ${moneyBefore}`);
  logger.info(`WETH after closing pos * current price: ${moneyAfter}`);
  const delta = moneyAfter - moneyBefore;
  logger.info(`Position income/loss: ${delta}`);
}
