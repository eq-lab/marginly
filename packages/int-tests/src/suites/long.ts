import assert = require('assert');
import { BigNumber } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { logger } from '../utils/logger';
import {
  getLongSortKeyX48,
  decodeSwapEvent,
  CallType,
  assertAccruedRateCoeffs,
  uniswapV3Swapdata,
} from '../utils/chain-ops';
import { fp48ToHumanString, FP96, toHumanString } from '../utils/fixed-point';
import { ZERO_ADDRESS } from '../utils/const';
import { showSystemAggregates } from '../utils/log-utils';

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
      await marginlyPool
        .connect(lenders[i])
        .execute(CallType.DepositQuote, quoteAmount, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), { gasLimit: 500_000 })
    );
    await gasReporter.saveGasUsage(
      'depositBase',
      marginlyPool
        .connect(lenders[i])
        .execute(CallType.DepositBase, baseAmount, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), { gasLimit: 500_000 })
    );
  }

  const realQuoteBalance = await usdc.balanceOf(marginlyPool.address);
  logger.info(`RealQuoteBalance is: ${formatUnits(realQuoteBalance, 6)} USDC`);
  assert.deepEqual(expectedRealQuoteBalance, realQuoteBalance, 'realQuoteBalance');

  const params = await marginlyPool.params();
  const maxLeverageX96 = BigNumber.from(params.maxLeverage).mul(FP96.one);
  const swapFeeX96 = BigNumber.from(params.swapFee).mul(FP96.one).div(1e6);
  const wethPriceX96 = (await marginlyPool.getBasePrice()).inner;
  const feeHolder = await marginlyFactory.feeHolder();

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
      await marginlyPool
        .connect(borrowers[i])
        .execute(CallType.DepositBase, initialBorrBaseBalance, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), {
          gasLimit: 500_000,
        })
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

    const discountedBaseCollateralBefore = await marginlyPool.discountedBaseCollateral();
    const discountedBaseDebtBefore = await marginlyPool.discountedBaseDebt();
    const discountedQuoteCollateralBefore = await marginlyPool.discountedQuoteCollateral();
    const discountedQuoteDebtBefore = await marginlyPool.discountedQuoteDebt();
    const feeHolderBalanceBefore = await usdc.balanceOf(feeHolder);
    const positionBefore = await marginlyPool.positions(borrowers[i].address);
    const realQuoteBalanceBefore = await usdc.balanceOf(marginlyPool.address);
    const realBaseBalanceBefore = await weth.balanceOf(marginlyPool.address);
    const prevBlockNumber = await marginlyPool.provider.getBlockNumber();
    logger.info(`Before long transaction`);
    const maxPrice = (await marginlyPool.getBasePrice()).inner.mul(2);
    const txReceipt = await (
      await marginlyPool
        .connect(borrowers[i])
        .execute(CallType.Long, longAmount, 0, maxPrice, false, ZERO_ADDRESS, uniswapV3Swapdata(), { gasLimit: 1_900_000 })
    ).wait();
    await gasReporter.saveGasUsage('long', txReceipt);
    const swapEvent = decodeSwapEvent(txReceipt, uniswap.address);
    //check position

    //check coefficients
    const discountedBaseCollateral = await marginlyPool.discountedBaseCollateral();
    const discountedBaseDebt = await marginlyPool.discountedBaseDebt();
    const discountedQuoteCollateral = await marginlyPool.discountedQuoteCollateral();
    const discountedQuoteDebt = await marginlyPool.discountedQuoteDebt();
    const feeHolderBalance = await usdc.balanceOf(feeHolder);
    const position = await marginlyPool.positions(borrowers[i].address);
    const realQuoteBalance = await usdc.balanceOf(marginlyPool.address);
    const sortKeyX48 = await getLongSortKeyX48(marginlyPool, borrowers[i].address);
    const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
    const realBaseBalance = await weth.balanceOf(marginlyPool.address);

    const expectedCoeffs = await assertAccruedRateCoeffs(marginlyPool, prevBlockNumber);
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

    //discountedBaseCollateral
    const expectedDiscountedBaseCollateralChange = longAmount.mul(FP96.one).div(baseCollateralCoeff);
    logger.info(` DiscountedBaseCollateral change ${expectedDiscountedBaseCollateralChange}`);
    assert.deepEqual(
      positionBefore.discountedBaseAmount.add(expectedDiscountedBaseCollateralChange),
      position.discountedBaseAmount,
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

    const expectedPositionDiscountedQuoteDebt = positionBefore.discountedQuoteAmount.add(expectedDiscountedDebtChange);
    if (!expectedPositionDiscountedQuoteDebt.sub(position.discountedQuoteAmount).abs().eq(BigNumber.from(0))) {
      throw `wrong position.discountedQuoteAmount: expected: ${expectedPositionDiscountedQuoteDebt} actual: ${position.discountedQuoteAmount}`;
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

    const actualQuoteDebtFee = discountedQuoteCollateral.sub(discountedQuoteCollateralBefore);

    // discountedQuoteCollateral
    assert.deepEqual(actualQuoteDebtFee, expectedCoeffs.discountedQuoteDebtFee);

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
    const prevBlockNumber = await marginlyPool.provider.getBlockNumber();
    nextDate += numOfSeconds;
    await provider.mineAtTimestamp(nextDate);

    const quoteCollateralCoeffBefore = BigNumber.from(await marginlyPool.quoteCollateralCoeff());
    const quoteDebtCoeffBefore = await marginlyPool.quoteDebtCoeff();

    //reinit tx
    const txReceipt = await (
      await marginlyPool
        .connect(treasury)
        .execute(CallType.Reinit, 0, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), { gasLimit: 500_000 })
    ).wait();
    await gasReporter.saveGasUsage('reinit', txReceipt);

    const marginCallEvent = txReceipt.events?.find((e) => e.event == 'EnactMarginCall');
    if (marginCallEvent) {
      logger.info(`\n`);
      logger.warn(`Margin call happened at day ${i} (${nextDate} time)`);
      logger.warn(` mc account: ${marginCallEvent.args![0]}`);
    }

    const expectedCoeffs = await assertAccruedRateCoeffs(marginlyPool, prevBlockNumber, !!marginCallEvent);

    //check coefficients
    const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
    const discountedQuoteDebt = await marginlyPool.discountedQuoteDebt();
    const discountedQuoteCollateral = await marginlyPool.discountedQuoteCollateral();

    if (!marginCallEvent) {
      const quoteDebtDelta = quoteDebtCoeff.sub(quoteDebtCoeffBefore).mul(discountedQuoteDebt).div(FP96.one);

      const quoteCollatDelta = quoteCollateralCoeff
        .sub(quoteCollateralCoeffBefore)
        .mul(discountedQuoteCollateral)
        .div(FP96.one);

      const realDebtFee = expectedCoeffs.discountedQuoteDebtFee.mul(quoteCollateralCoeff).div(FP96.one);

      // quote collateral change + debt fee == quote debt change
      const epsilon = BigNumber.from(200);
      const delta = quoteDebtDelta.sub(quoteCollatDelta).sub(realDebtFee).abs();
      if (delta.gt(epsilon)) {
        logger.warn(`quoteDebtDelta: ${formatUnits(quoteDebtDelta, 6)} USDC`);
        logger.warn(`quoteCollatDelta: ${formatUnits(quoteCollatDelta, 6)} USDC`);
        logger.warn(`quoteDbtFee: ${formatUnits(expectedCoeffs.discountedQuoteDebtFee, 6)} USDC`);
        logger.error(`delta is ${delta} they must be equal`);
      }
      // assert.deepEqual(quoteDebtDelta, quoteCollatDelta);
    }
  }

  const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
  const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();
  const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();

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

    const realBaseAmount = baseCollateralCoeff.mul(position.discountedBaseAmount).div(FP96.one);
    const realQuoteAmount = quoteDebtCoeff.mul(position.discountedQuoteAmount).div(FP96.one);

    logger.info(` sortKey ${fp48ToHumanString(sortKeyX48)}`);
    logger.info(` sortKeyX48 ${sortKeyX48}`);
    logger.info(` collateral ${formatUnits(realBaseAmount, 18)} WETH, debt ${formatUnits(realQuoteAmount, 6)} USDC`);
  }

  await showSystemAggregates(sut);
}
