import assert = require('assert');
import { BigNumber } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { logger } from '../utils/logger';
import { CallType, decodeSwapEvent, uniswapV3Swapdata } from '../utils/chain-ops';
import { FP96, toHumanString } from '../utils/fixed-point';
import { changeWethPrice } from '../utils/uniswap-ops';
import { ZERO_ADDRESS } from '../utils/const';

export async function shortIncome(sut: SystemUnderTest) {
  logger.info(`Starting shortIncome test suite`);
  const { marginlyPool, treasury, usdc, weth, accounts, provider, uniswap, gasReporter } = sut;

  const swapFeeX96 = BigNumber.from((await marginlyPool.params()).swapFee)
    .mul(FP96.one)
    .div(1e6);
  logger.info(`swapFee: ${toHumanString(swapFeeX96)}`);

  const numberOfLenders = 2;
  const lenders = accounts.slice(0, numberOfLenders);
  const baseAmount = parseUnits('20', 18); // 20 WETH

  logger.info(`Deposit quote and base`);
  for (let i = 0; i < lenders.length; i++) {
    await (await weth.connect(treasury).transfer(lenders[i].address, baseAmount)).wait();
    await (await weth.connect(lenders[i]).approve(marginlyPool.address, baseAmount)).wait();

    await gasReporter.saveGasUsage(
      'depositBase',
      marginlyPool
        .connect(lenders[i])
        .execute(CallType.DepositBase, baseAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), { gasLimit: 500_000 })
    );
  }

  const wethPriceX96 = BigNumber.from((await marginlyPool.getBasePrice()).inner).mul(10n ** 12n);

  logger.info(`Weth price = ${toHumanString(wethPriceX96)}`);

  const borrower = accounts[numberOfLenders];
  const initialBorrQuoteBalance = BigNumber.from(1_000_000) // 1 WETH is USDC
    .mul(wethPriceX96)
    .div(FP96.one);
  logger.info(`borrower initial deposit: ${formatUnits(initialBorrQuoteBalance, 6)} USDC`);

  await (await usdc.connect(treasury).transfer(borrower.address, initialBorrQuoteBalance)).wait();
  await (await usdc.connect(borrower).approve(marginlyPool.address, initialBorrQuoteBalance)).wait();

  await gasReporter.saveGasUsage(
    'depositQuote',
    marginlyPool
      .connect(borrower)
      .execute(CallType.DepositQuote, initialBorrQuoteBalance, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), {
        gasLimit: 500_000,
      })
  );

  // we are checking nothing here since it's basically short test with extra step
  const shortAmount = parseUnits('5', 18);
  logger.info(`Open ${formatUnits(shortAmount, 18)} WETH short position`);

  await gasReporter.saveGasUsage(
    'short',
    marginlyPool
      .connect(borrower)
      .execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), { gasLimit: 1_500_000 })
  );

  logger.info(`Decreasing WETH price by ~10%`);
  await changeWethPrice(treasury, provider.provider, sut, wethPriceX96.mul(9).div(10).div(FP96.one));

  const shiftInDays = 10;
  logger.info(`Shift date by ${shiftInDays} days`);
  // shift time
  const numOfSeconds = shiftInDays * 24 * 60 * 60;
  await provider.mineAtTimestamp(+BigNumber.from(await marginlyPool.lastReinitTimestampSeconds()) + numOfSeconds);

  logger.info(`reinit`);
  const reinitReceipt = await gasReporter.saveGasUsage(
    'reinit',
    marginlyPool
      .connect(treasury)
      .execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), { gasLimit: 1_000_000 })
  );
  logger.info(`reinit executed`);
  const marginCallEvent = reinitReceipt.events?.find((e) => e.event == 'EnactMarginCall');
  if (marginCallEvent) {
    const error = `MC happened, try reducing time shift`;
    logger.error(error);
    throw new Error(error);
  }

  const positionBefore = await marginlyPool.positions(borrower.address);
  const positionDiscountedQuoteAmountBefore = BigNumber.from(positionBefore.discountedQuoteAmount);
  const discountedQuoteCollBefore = BigNumber.from(await marginlyPool.discountedQuoteCollateral());

  logger.info(`Closing position`);
  const closePosReceipt = await gasReporter.saveGasUsage(
    'closePosition',
    marginlyPool
      .connect(borrower)
      .execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), { gasLimit: 1_000_000 })
  );
  const closePosSwapEvent = decodeSwapEvent(closePosReceipt, uniswap.address);
  const swapAmount = closePosSwapEvent.amount0;
  logger.info(`swapAmount: ${formatUnits(swapAmount, 6)} USDC`);
  const fee = swapFeeX96.mul(swapAmount).div(FP96.one);
  logger.info(`fee: ${formatUnits(fee, 6)}`);

  logger.info(`discountedBaseDebt: ${formatUnits(await marginlyPool.discountedBaseDebt(), 18)} WETH`);
  logger.info(`discountedQuoteCollateral: ${formatUnits(await marginlyPool.discountedQuoteCollateral(), 6)} USDC`);

  const positionAfter = await marginlyPool.positions(borrower.address);
  const positionDiscountedBaseAmountAfter = +BigNumber.from(positionAfter.discountedBaseAmount);

  logger.info(`position.discountedBaseAmount: ${formatUnits(positionAfter.discountedBaseAmount, 18)} ETH`);
  assert.deepEqual(0, positionDiscountedBaseAmountAfter, 'pos.discountedBaseAmount');

  const collCoeff = BigNumber.from(await marginlyPool.quoteCollateralCoeff());
  const positionDiscountedQuoteAmountAfter = BigNumber.from(positionAfter.discountedQuoteAmount);
  const expectedPosDiscountedQuoteAmount = positionDiscountedQuoteAmountBefore.sub(
    swapAmount.add(fee).mul(FP96.one).div(collCoeff)
  );
  logger.info(`position.discountedQuoteAmount: ${formatUnits(positionDiscountedQuoteAmountAfter, 6)}`);
  assert.deepEqual(expectedPosDiscountedQuoteAmount, positionDiscountedQuoteAmountAfter, 'pos.discountedQuoteAmount');

  const positionRealQuoteAmount = BigNumber.from(positionAfter.discountedQuoteAmount).mul(collCoeff).div(FP96.one);
  logger.info(`position real quote amount: ${formatUnits(positionRealQuoteAmount, 6)} USDC`);

  const discountedQuoteCollAfter = BigNumber.from(await marginlyPool.discountedQuoteCollateral());
  const expectedDiscountedQuoteColl = discountedQuoteCollBefore.sub(swapAmount.add(fee).mul(FP96.one).div(collCoeff));
  assert.deepEqual(expectedDiscountedQuoteColl, discountedQuoteCollAfter, 'discountedQuoteCollateral');

  const discountedBaseDebt = +BigNumber.from(await marginlyPool.discountedBaseDebt());
  assert.deepEqual(discountedBaseDebt, 0, 'discountedBaseDebt');

  const moneyBefore = +formatUnits(initialBorrQuoteBalance, 6);
  const moneyAfter = +formatUnits(positionRealQuoteAmount, 6);
  logger.info(`USDC initial deposit:   ${moneyBefore}`);
  logger.info(`USDC after closing pos: ${moneyAfter}`);
  const delta = moneyAfter - moneyBefore;
  logger.info(`Position income/loss: ${delta} USDC`);
}
