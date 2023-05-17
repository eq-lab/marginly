import assert = require('assert');
import { BigNumber } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { logger } from '../utils/logger';
import { getLongSortKeyX48, decodeSwapEvent, CallType } from '../utils/chain-ops';
import { fp48ToHumanString, FP96, pow, powTaylor, secondsInYearX96, toHumanString } from '../utils/fixed-point';
import { ZERO_ADDRESS } from '../utils/const';

export async function long(sut: SystemUnderTest) {
  logger.info(`Starting long test suite`);

  const { marginlyPool, marginlyFactory, treasury, usdc, weth, accounts, provider, uniswap, gasReporter } = sut;

  const lenders = accounts.slice(0, 20); // 2 lenders
  const quoteAmount = parseUnits('1000000', 6); // 1_000_000 USDC
  const expectedRealQuoteBalance = quoteAmount.mul(lenders.length);
  const baseAmount = parseUnits('20', 18); // 10 WETH

  logger.info(`Deposit quote and base`);
  for (let i = 0; i < lenders.length; i++) {
    await (await usdc.connect(treasury).transfer(lenders[i].address, quoteAmount)).wait();
    await (await usdc.connect(lenders[i]).approve(marginlyPool.address, quoteAmount)).wait();

    await (await weth.connect(treasury).transfer(lenders[i].address, baseAmount)).wait();
    await (await weth.connect(lenders[i]).approve(marginlyPool.address, baseAmount)).wait();

    await gasReporter.saveGasUsage(
      'depositQuote',
      await marginlyPool.connect(lenders[i]).execute(CallType.DepositQuote, quoteAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    );
    await gasReporter.saveGasUsage(
      'depositBase',
      marginlyPool.connect(lenders[i]).execute(CallType.DepositBase, baseAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    );
  }

  const realQuoteBalance = await usdc.balanceOf(marginlyPool.address);
  logger.info(`RealQuoteBalance is: ${formatUnits(realQuoteBalance, 6)} USDC`);
  assert.deepEqual(expectedRealQuoteBalance, realQuoteBalance, 'realQuoteBalance');

  const params = await marginlyPool.params();
  const maxLeverageX96 = BigNumber.from(params.maxLeverage).mul(FP96.one);
  const swapFeeX96 = BigNumber.from(params.swapFee).mul(FP96.one).div(1e6);
  const wethPriceX96 = BigNumber.from((await marginlyPool.getBasePrice()).inner);
  const feeHolder = await marginlyFactory.feeHolder();
  const interestRateX96 = BigNumber.from(params.interestRate).mul(FP96.one).div(1e6);

  logger.info(`MaxLeverage = ${maxLeverageX96.div(2n ** 96n)}`);
  logger.info(`SwapFeeX96 = ${toHumanString(swapFeeX96)}`);
  logger.info(`Weth price = ${toHumanString(wethPriceX96.mul(10n ** 12n))}`);

  //prepare base depositors
  const borrowers = accounts.slice(20, 40); // 120 borrowers
  const initialBorrBaseBalance = parseUnits('2', 18); // 2 WETH
  const expectedRealBaseBalance = initialBorrBaseBalance.mul(borrowers.length).add(baseAmount.mul(lenders.length));

  for (let i = 0; i < borrowers.length; i++) {
    await (await weth.connect(treasury).transfer(borrowers[i].address, initialBorrBaseBalance)).wait();
    await (await weth.connect(borrowers[i]).approve(marginlyPool.address, initialBorrBaseBalance)).wait();

    await gasReporter.saveGasUsage(
      'depositBase',
      await marginlyPool.connect(borrowers[i]).execute(CallType.DepositBase, initialBorrBaseBalance, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    );
    const position = await marginlyPool.positions(borrowers[i].address);
    assert.deepEqual(initialBorrBaseBalance, position.discountedBaseAmount);
  }

  const realBaseBalance = await weth.balanceOf(marginlyPool.address);
  assert(expectedRealBaseBalance.eq(realBaseBalance));

  logger.info(`RealBaseBalance: ${formatUnits(realBaseBalance, 18)} WETH`);

  logger.info(`Open long positions and check coeffs:`);
  for (let i = 0; i < borrowers.length; i++) {
    const longAmount = parseUnits('8', 18).add(parseUnits('0.5', 18).mul(i)); // 8 + (0.25*(i+1)) WETH

    logger.info(`\n`);
    logger.info(`${i + 1}) long for account ${borrowers[i].address}`);

    const root = i == 0 ? undefined : (await marginlyPool.getLongHeapPosition(0))[1].account;

    const discountedBaseCollateralBefore = BigNumber.from(await marginlyPool.discountedBaseCollateral());
    const discountedBaseDebtBefore = BigNumber.from(await marginlyPool.discountedBaseDebt());
    const discountedQuoteCollateralBefore = BigNumber.from(await marginlyPool.discountedQuoteCollateral());
    const discountedQuoteDebtBefore = BigNumber.from(await marginlyPool.discountedQuoteDebt());
    const feeHolderBalanceBefore = BigNumber.from(await usdc.balanceOf(feeHolder));
    const positionBefore = await marginlyPool.positions(borrowers[i].address);
    const realQuoteBalanceBefore = BigNumber.from(await usdc.balanceOf(marginlyPool.address));
    const quoteDebtCoeffBefore = BigNumber.from(await marginlyPool.quoteDebtCoeff());
    const leverageLongBefore = BigNumber.from((await marginlyPool.systemLeverage()).longX96);
    const realBaseBalanceBefore = BigNumber.from(await weth.balanceOf(marginlyPool.address));
    const lastReinitTimestampBefore = BigNumber.from(await marginlyPool.lastReinitTimestampSeconds());

    logger.info(`Before long transaction`);
    const txReceipt = await (await marginlyPool.connect(borrowers[i]).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS, { gasLimit: 1_900_000 })).wait();
    await gasReporter.saveGasUsage('long', txReceipt);
    const swapEvent = decodeSwapEvent(txReceipt, uniswap.address);
    //check position

    //check coefficients
    const discountedBaseCollateral = BigNumber.from(await marginlyPool.discountedBaseCollateral());
    const discountedBaseDebt = BigNumber.from(await marginlyPool.discountedBaseDebt());
    const discountedQuoteCollateral = BigNumber.from(await marginlyPool.discountedQuoteCollateral());
    const discountedQuoteDebt = BigNumber.from(await marginlyPool.discountedQuoteDebt());
    const feeHolderBalance = BigNumber.from(await usdc.balanceOf(feeHolder));
    const position = await marginlyPool.positions(borrowers[i].address);
    const realQuoteBalance = BigNumber.from(await usdc.balanceOf(marginlyPool.address));
    const sortKeyX48 = await getLongSortKeyX48(marginlyPool, borrowers[i].address);
    const baseCollateralCoeff = BigNumber.from(await marginlyPool.baseCollateralCoeff());
    const quoteDebtCoeff = BigNumber.from(await marginlyPool.quoteDebtCoeff());
    const realBaseBalance = BigNumber.from(await weth.balanceOf(marginlyPool.address));
    const lastReinitTimestamp = BigNumber.from(await marginlyPool.lastReinitTimestampSeconds());

    //leverage
    logger.info(` SortKeyX48 is ${sortKeyX48}`);

    //fee
    const expectedFee = swapEvent.amount0.mul(swapFeeX96).div(FP96.one);
    const fee = feeHolderBalance.sub(feeHolderBalanceBefore);
    assert.deepEqual(fee, expectedFee);
    logger.info(` fee charged ${formatUnits(fee, 6)} USDC`);

    //swap
    const realQuoteAmount = swapEvent.amount0;
    logger.info(
      ` Uniswap: QuoteIn ${formatUnits(realQuoteAmount, 6)} USDC, BaseOut: ${formatUnits(longAmount, 18)} WETH`
    );

    // quoteDebtCoeff
    const secondsPassed = lastReinitTimestamp.sub(lastReinitTimestampBefore);
    // (longLeverage * interest_rate / year + 1) ^ secondsPassed
    const quoteDebtCoeffMul = powTaylor(
      leverageLongBefore.mul(interestRateX96).div(secondsInYearX96).add(FP96.one),
      +secondsPassed
    );
    const expectedQuoteDebtCoeff = quoteDebtCoeffBefore.mul(quoteDebtCoeffMul).div(FP96.one);
    assert.deepEqual(expectedQuoteDebtCoeff, quoteDebtCoeff);

    //discountedBaseCollateral
    const expectedDiscountedBaseCollateralChange = longAmount.mul(FP96.one).div(baseCollateralCoeff);
    logger.info(` DiscountedBaseCollateral change ${expectedDiscountedBaseCollateralChange}`);
    assert.deepEqual(
      BigNumber.from(positionBefore.discountedBaseAmount).add(expectedDiscountedBaseCollateralChange),
      BigNumber.from(position.discountedBaseAmount),
      'position.discountedBaseAmount'
    );
    assert.deepEqual(
      discountedBaseCollateralBefore.add(expectedDiscountedBaseCollateralChange),
      discountedBaseCollateral,
      'discountedBaseCollateral'
    );

    //discountedBaseDebt
    assert.deepEqual(discountedBaseDebtBefore, discountedBaseDebt);

    //discountedQuoteDebt
    const expectedDiscountedDebtChange = realQuoteAmount.add(fee).mul(FP96.one).div(quoteDebtCoeff);
    const actualDiscountedDebtChange = discountedQuoteDebt.sub(discountedQuoteDebtBefore);
    logger.info(` expected DiscountedDebtChange ${expectedDiscountedDebtChange}`);
    logger.info(` actual DiscountedDebtChange ${actualDiscountedDebtChange}`);

    const expectedPositionDiscountedQuoteDebt = BigNumber.from(positionBefore.discountedQuoteAmount).add(
      expectedDiscountedDebtChange
    );
    const actualPositionDiscountedQuoteDebt = BigNumber.from(position.discountedQuoteAmount);
    if (!expectedPositionDiscountedQuoteDebt.sub(actualPositionDiscountedQuoteDebt).abs().eq(BigNumber.from(0))) {
      throw `wrong position.discountedQuoteAmount: expected: ${expectedPositionDiscountedQuoteDebt} actual: ${actualPositionDiscountedQuoteDebt}`;
    }

    const expectedDiscountedDebt = discountedQuoteDebtBefore.add(expectedDiscountedDebtChange);
    if (!expectedDiscountedDebt.sub(discountedQuoteDebt).abs().eq(0n)) {
      throw `wrong discountedQuoteDebt: expected: ${expectedDiscountedDebt} actual: ${discountedQuoteDebt}`;
    }

    // position type should be changed
    if (BigNumber.from(positionBefore._type).eq(BigNumber.from(1))) {
      //Lend -> Long
      assert.deepEqual(BigNumber.from(position._type), BigNumber.from(3), 'position type');
    } else {
      // Long
      assert.deepEqual(BigNumber.from(position._type), BigNumber.from(positionBefore._type), 'position type');
    }

    // discountedQuoteCollateral
    assert.deepEqual(discountedQuoteCollateralBefore, discountedQuoteCollateral);

    //realQuoteBalance
    const expectedRealQuoteBalanceChange = fee.add(realQuoteAmount);
    const realQuoteBalanceChange = realQuoteBalance.sub(realQuoteBalanceBefore);
    logger.info(` RealQuoteBalance change ${formatUnits(realQuoteBalanceChange, 6)} USDC`);
    assert.deepEqual(realQuoteBalanceBefore, realQuoteBalance.add(expectedRealQuoteBalanceChange));

    //realBaseBalance
    const expectedRealBaseBalanceChange = longAmount;
    const realBaseBalanceChange = realBaseBalance.sub(realBaseBalanceBefore);
    logger.info(` RealBaseBalance change ${formatUnits(realBaseBalanceChange, 18)} WETH`);
    assert.deepEqual(realBaseBalanceBefore.add(expectedRealBaseBalanceChange), realBaseBalance);
  }

  logger.info(`Shift date for 1 year, 1 day per iteration`);
  // shift time to 1 year
  const numOfSeconds = 24 * 60 * 60; // 1 day
  let nextDate = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 365; i++) {
    nextDate += numOfSeconds;
    await provider.mineAtTimestamp(nextDate);

    const lastReinitTimestampSecondsBefore = BigNumber.from(await marginlyPool.lastReinitTimestampSeconds());
    const quoteCollateralCoeffBefore = BigNumber.from(await marginlyPool.quoteCollateralCoeff());
    const quoteDebtCoeffBefore = BigNumber.from(await marginlyPool.quoteDebtCoeff());
    const discountedBaseDebtBefore = BigNumber.from(await marginlyPool.discountedBaseDebt());
    const discountedBaseCollateralBefore = BigNumber.from(await marginlyPool.discountedBaseCollateral());
    const discountedQuoteDebtBefore = BigNumber.from(await marginlyPool.discountedQuoteDebt());
    const discountedQuoteCollateralBefore = BigNumber.from(await marginlyPool.discountedQuoteCollateral());
    const leverageLongBefore = BigNumber.from((await marginlyPool.systemLeverage()).longX96);

    //reinit tx
    const txReceipt = await (await marginlyPool.connect(treasury).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })).wait();
    await gasReporter.saveGasUsage('reinit', txReceipt);

    const marginCallEvent = txReceipt.events?.find((e) => e.event == 'EnactMarginCall');
    if (marginCallEvent) {
      logger.info(`\n`);
      logger.warn(`Margin call happened at day ${i} (${nextDate} time)`);
      logger.warn(` mc account: ${marginCallEvent.args![0]}`);
    }

    //check coefficients
    const lastReinitTimestampSeconds = BigNumber.from(await marginlyPool.lastReinitTimestampSeconds());
    const quoteCollateralCoeff = BigNumber.from(await marginlyPool.quoteCollateralCoeff());
    const quoteDebtCoeff = BigNumber.from(await marginlyPool.quoteDebtCoeff());
    const discountedBaseDebt = BigNumber.from(await marginlyPool.discountedBaseDebt());
    const discountedBaseCollateral = BigNumber.from(await marginlyPool.discountedBaseCollateral());
    const discountedQuoteDebt = BigNumber.from(await marginlyPool.discountedQuoteDebt());
    const discountedQuoteCollateral = BigNumber.from(await marginlyPool.discountedQuoteCollateral());

    //lastReinitTimestamp
    const actualSecondsPassed = lastReinitTimestampSeconds.sub(lastReinitTimestampSecondsBefore);

    // quoteDebtCoeff
    const quoteDebtCoeffMul = powTaylor(
      leverageLongBefore.mul(interestRateX96).div(secondsInYearX96).add(FP96.one),
      +actualSecondsPassed
    );
    const expectedQuoteDebtCoeff = quoteDebtCoeffBefore.mul(quoteDebtCoeffMul).div(FP96.one);
    assert.deepEqual(expectedQuoteDebtCoeff, quoteDebtCoeff);

    if (!marginCallEvent) {
      const quoteDebtDelta = quoteDebtCoeff.sub(quoteDebtCoeffBefore).mul(discountedQuoteDebt).div(FP96.one);

      const quoteCollatDelta = quoteCollateralCoeff
        .sub(quoteCollateralCoeffBefore)
        .mul(discountedQuoteCollateral)
        .div(FP96.one);

      // quote collateral change == quote debt change
      const epsilon = BigNumber.from(1);
      if (quoteDebtDelta.sub(quoteCollatDelta).abs().gt(epsilon)) {
        logger.warn(`quoteDebtDelta: ${formatUnits(quoteDebtDelta, 6)} USDC`);
        logger.warn(`quoteCollatDelta: ${formatUnits(quoteCollatDelta, 6)} USDC`);
        logger.error(`they must be equal`);
      }
      // assert.deepEqual(quoteDebtDelta, quoteCollatDelta);
    }
  }

  const quoteCollateralCoeff = BigNumber.from(await marginlyPool.quoteCollateralCoeff());
  const baseCollateralCoeff = BigNumber.from(await marginlyPool.baseCollateralCoeff());
  const quoteDebtCoeff = BigNumber.from(await marginlyPool.quoteDebtCoeff());

  //check lender positions
  logger.info(`Check lenders after reinit`);
  for (let i = 0; i < lenders.length; i++) {
    logger.info(`\n`);
    logger.info(`${i + 1}) lender ${lenders[i].address}`);
    const position = await marginlyPool.positions(lenders[i].address);

    const discountedQuoteAmount = BigNumber.from(position.discountedQuoteAmount);
    const realQuoteAmount = quoteCollateralCoeff.mul(discountedQuoteAmount).div(FP96.one);

    logger.info(` Deposit ${formatUnits(quoteAmount, 6)} USDC, current ${formatUnits(realQuoteAmount, 6)} USDC`);
  }

  logger.info(`Check borrowers after reinit`);
  for (let i = 0; i < borrowers.length; i++) {
    logger.info(`\n`);
    logger.info(`${i + 1}) borrower ${borrowers[i].address}`);
    const position = await marginlyPool.positions(borrowers[i].address);
    logger.info(` position type ${position._type}`);
    if (position._type == 0) {
      logger.info(` position not exists`);
      continue;
    }

    const sortKeyX48 = await getLongSortKeyX48(marginlyPool, borrowers[i].address);
    const discountedBaseAmount = BigNumber.from(position.discountedBaseAmount);
    const discountedQuoteAmount = BigNumber.from(position.discountedQuoteAmount);

    const realBaseAmount = baseCollateralCoeff.mul(discountedBaseAmount).div(FP96.one);
    const realQuoteAmount = quoteDebtCoeff.mul(discountedQuoteAmount).div(FP96.one);

    logger.info(` sortKey ${fp48ToHumanString(sortKeyX48)}`);
    logger.info(` sortKeyX48 ${sortKeyX48}`);
    logger.info(` collateral ${formatUnits(realBaseAmount, 18)} WETH, debt ${formatUnits(realQuoteAmount, 6)} USDC`);
  }
}
