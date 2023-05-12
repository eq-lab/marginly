import { BigNumber } from 'ethers';
import { SystemUnderTest } from '.';
import { logger } from '../utils/logger';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { fp48ToHumanString, FP96, pow, powTaylor, secondsInYearX96, toHumanString } from '../utils/fixed-point';
import { decodeSwapEvent, getShortSortKeyX48 } from '../utils/chain-ops';
import assert = require('assert');

async function prepareAccounts(sut: SystemUnderTest) {
  const { treasury, usdc, weth, accounts, marginlyPool } = sut;

  for (const account of accounts) {
    await Promise.all([
      (await usdc.connect(treasury).transfer(account.address, parseUnits('200000000', 6))).wait(),
      (await weth.connect(treasury).transfer(account.address, parseUnits('200000000', 18))).wait(),
    ]);
  }
}

export async function short(sut: SystemUnderTest) {
  logger.info(`Starting short test suite`);
  await prepareAccounts(sut);
  logger.info(`Prepared accounts`);
  const { marginlyPool, marginlyFactory, usdc, weth, accounts, treasury, provider, uniswap, gasReporter } = sut;

  const lendersNumber = 2;
  const shortersNumber = 10;
  const lenders = accounts.slice(0, lendersNumber);
  const shorters = accounts.slice(lendersNumber, lendersNumber + shortersNumber);

  const baseAmount = 200_000_000n * 10n ** 18n;
  const quoteAmount = 200_000_000n * 10n ** 6n;

  const baseAmountsLenders = [];
  const baseDebtsShorters = [];

  for (const lender of lenders) {
    logger.info(`lender depositBase call`);
    await (await weth.connect(lender).approve(marginlyPool.address, baseAmount)).wait();
    await gasReporter.saveGasUsage(
      'depositBase',
      marginlyPool.connect(lender).depositBase(baseAmount, 0,{ gasLimit: 500_000 })
    );
    logger.info(`lender depositBase call success`);
    baseAmountsLenders.push(baseAmount);

    logger.info(`lender depositQuote call`);
    await (await usdc.connect(lender).approve(marginlyPool.address, baseAmount)).wait();
    await gasReporter.saveGasUsage(
      'depositQuote',
      marginlyPool.connect(lender).depositQuote(quoteAmount, 0,{ gasLimit: 500_000 })
    );
    logger.info(`lender depositQuote call success`);
  }

  const maxLeverageX96 = BigNumber.from((await marginlyPool.params()).maxLeverage).mul(FP96.one);
  logger.info(`maxLeverage: ${maxLeverageX96}`);
  const basePrice = BigNumber.from((await marginlyPool.getBasePrice()).inner);
  logger.info(`basePrice: ${toHumanString(basePrice.mul(10 ** 12))} * 10 ** (-12) USDC/WETH`);

  const swapFeeX96 = BigNumber.from((await marginlyPool.params()).swapFee)
    .mul(FP96.one)
    .div(1e6);
  logger.info(`swapFee: ${toHumanString(swapFeeX96)}`);
  const feeHolder = await marginlyFactory.feeHolder();

  const interestRateX96 = BigNumber.from((await marginlyPool.params()).interestRate)
    .mul(FP96.one)
    .div(1e6);
  logger.info(`interestRate: ${toHumanString(interestRateX96)}`);

  // 30 WETH equivalent in usdc
  const initCollateral = BigNumber.from(30n * 10n ** 18n)
    .mul(basePrice)
    .div(FP96.one);
  logger.info(`initCollateral: ${formatUnits(initCollateral, 6)} USDC`);

  for (let i = 0; i < shortersNumber; ++i) {
    const shorter = shorters[i];
    console.log(`\n`);
    logger.info(`shorter: ${shorter.address}`);
    logger.info(`depositQuote call`);
    await (await usdc.connect(shorter).approve(marginlyPool.address, initCollateral)).wait();

    const shorterBalance = await usdc.balanceOf(shorter.address);
    const allowance = await usdc.allowance(shorter.address, marginlyPool.address);
    logger.info(`Shorter balance is ${formatUnits(shorterBalance, 6)} USDC`);
    logger.info(`Allowance balance is ${formatUnits(allowance, 6)} USDC`);

    await gasReporter.saveGasUsage(
      'depositQuote',
      marginlyPool.connect(shorter).depositQuote(initCollateral, 0,{ gasLimit: 700_000 })
    );
    logger.info(`depositQuote call success`);

    const rootAccount = i == 0 ? undefined : (await marginlyPool.getShortHeapPosition(0))[1].account;

    const feeHolderBalanceBefore = BigNumber.from(await usdc.balanceOf(feeHolder));
    const baseCollateralBefore = BigNumber.from(await marginlyPool.discountedBaseCollateral());
    const baseDebtBefore = BigNumber.from(await marginlyPool.discountedBaseDebt());
    const quoteCollateralBefore = BigNumber.from(await marginlyPool.discountedQuoteCollateral());
    const quoteDebtBefore = BigNumber.from(await marginlyPool.discountedQuoteDebt());
    const leverageShortBefore = BigNumber.from((await marginlyPool.systemLeverage()).shortX96);
    const quoteColCoeff = BigNumber.from(await marginlyPool.quoteCollateralCoeff());
    const baseDebtCoeffBefore = BigNumber.from(await marginlyPool.baseDebtCoeff());
    const lastReinitTimestampBefore = BigNumber.from(await marginlyPool.lastReinitTimestampSeconds());

    const shortAmount = BigNumber.from(5n * 10n ** 18n).mul(BigNumber.from(i + 1));
    logger.info(`shortAmount: ${formatUnits(shortAmount, 18)} WETH`);

    logger.info(`short call`);
    const txReceipt = await gasReporter.saveGasUsage(
      'short',
      marginlyPool.connect(shorter).short(shortAmount, { gasLimit: 1_000_000 })
    );
    const swapEvent = decodeSwapEvent(txReceipt, uniswap.address);
    logger.info(`short call success`);
    baseDebtsShorters.push(shortAmount);

    const baseCollateralAfter = BigNumber.from(await marginlyPool.discountedBaseCollateral());
    const baseDebtAfter = BigNumber.from(await marginlyPool.discountedBaseDebt());
    const quoteCollateralAfter = BigNumber.from(await marginlyPool.discountedQuoteCollateral());
    const quoteDebtAfter = BigNumber.from(await marginlyPool.discountedQuoteDebt());
    const baseDebtCoeff = BigNumber.from(await marginlyPool.baseDebtCoeff());
    const lastReinitTimestamp = BigNumber.from(await marginlyPool.lastReinitTimestampSeconds());
    const sortKeyX48 = await getShortSortKeyX48(marginlyPool, shorter.address);

    if (!baseCollateralBefore.eq(baseCollateralAfter)) {
      const error = `baseCollateral shouldn't change: before ${baseCollateralBefore}, now ${baseCollateralAfter}`;
      logger.error(error);
      throw new Error(error);
    }

    if (!quoteDebtBefore.eq(quoteDebtAfter)) {
      const error = `quoteDebt shouldn't change: before ${quoteDebtBefore}, now ${quoteDebtAfter}`;
      logger.error(error);
      throw new Error(error);
    }

    const secondsPassed = lastReinitTimestamp.sub(lastReinitTimestampBefore);
    // (shortLeverage * interest_rate / year + 1) ^ secondsPassed
    const baseDebtCoeffMul = powTaylor(
      leverageShortBefore.mul(interestRateX96).div(secondsInYearX96).add(FP96.one),
      +secondsPassed
    );
    const expectedBaseDebtCoeff = baseDebtCoeffBefore.mul(baseDebtCoeffMul).div(FP96.one);
    logger.info(`debtCoeff: ${toHumanString(expectedBaseDebtCoeff)}`);
    assert.deepEqual(expectedBaseDebtCoeff, baseDebtCoeff);

    const expectedBaseChange = shortAmount.mul(FP96.one).div(baseDebtCoeff);
    const expectedBaseDebtAfterShort = baseDebtBefore.add(expectedBaseChange);
    if (!baseDebtAfter.eq(expectedBaseDebtAfterShort)) {
      const error = `wrong baseDebt: expected ${expectedBaseDebtAfterShort}, actual ${baseDebtAfter}`;
      logger.error(error);
      throw new Error(error);
    }

    const realQuoteAmount = swapEvent.amount0.abs();
    logger.info(`realQuoteAmount: ${formatUnits(realQuoteAmount, 6)}`);
    const fee = swapFeeX96.mul(realQuoteAmount).div(FP96.one);
    const expectedQuoteChange = realQuoteAmount.sub(fee);
    logger.info(`expectedQuoteChange: ${formatUnits(expectedQuoteChange, 6)}`);
    const expectedQuoteColAfterShort = quoteCollateralBefore.add(expectedQuoteChange.mul(quoteColCoeff).div(FP96.one));

    if (!quoteCollateralAfter.eq(expectedQuoteColAfterShort)) {
      const error = `wrong quoteCollateral: expected ${expectedQuoteColAfterShort}, actual ${quoteCollateralAfter}`;
      logger.error(error);
      throw new Error(error);
    }

    const feeHolderBalanceAfterShort = BigNumber.from(await usdc.balanceOf(feeHolder));
    const expectedFeeHolderBalance = feeHolderBalanceBefore.add(fee);

    if (!feeHolderBalanceAfterShort.eq(expectedFeeHolderBalance)) {
      const error = `wrong feeHolderBalance: expected ${expectedFeeHolderBalance}, actual ${feeHolderBalanceAfterShort}`;
      logger.error(error);
      throw new Error(error);
    }

    const { _type, discountedBaseAmount, discountedQuoteAmount } = await marginlyPool.positions(shorter.address);

    if (!BigNumber.from(_type).eq(BigNumber.from(2))) {
      const error = `wrong position type: expected 2, actual ${_type}`;
      logger.error(error);
      throw new Error(error);
    }

    if (!BigNumber.from(discountedBaseAmount).eq(expectedBaseChange)) {
      const error = `wrong position.quoteAmount: expected ${expectedBaseChange} actual ${discountedBaseAmount}`;
      logger.error(error);
      throw new Error(error);
    }

    const expectedQuoteAmount = expectedQuoteChange.add(initCollateral);
    if (!BigNumber.from(discountedQuoteAmount).eq(expectedQuoteAmount)) {
      const error = `wrong position.baseAmount: expected ${expectedQuoteAmount}, actual ${discountedQuoteAmount}`;
      logger.error(error);
      throw new Error(error);
    }
  }

  logger.info(`Shift date for 1 day per iteration`);
  const numOfSeconds = 24 * 60 * 60; // 1 day
  let nextDate = Math.floor(Date.now() / 1000);

  for (let i = 1; i <= 365; i++) {
    nextDate += numOfSeconds;
    await provider.mineAtTimestamp(nextDate);

    const lastReinitTimestampSecondsBefore = BigNumber.from(await marginlyPool.lastReinitTimestampSeconds());
    const baseCollateralCoeffBefore = BigNumber.from(await marginlyPool.baseCollateralCoeff());
    const quoteCollateralCoeffBefore = BigNumber.from(await marginlyPool.quoteCollateralCoeff());
    const baseDebtCoeffBefore = BigNumber.from(await marginlyPool.baseDebtCoeff());
    const discountedBaseDebtBefore = BigNumber.from(await marginlyPool.discountedBaseDebt());
    const discountedBaseCollateralBefore = BigNumber.from(await marginlyPool.discountedBaseCollateral());
    const discountedQuoteDebtBefore = BigNumber.from(await marginlyPool.discountedQuoteDebt());
    const discountedQuoteCollateralBefore = BigNumber.from(await marginlyPool.discountedQuoteCollateral());
    const leverageShortBefore = BigNumber.from((await marginlyPool.systemLeverage()).shortX96);

    //reinit tx
    const txReceipt = await gasReporter.saveGasUsage(
      'reinit',
      marginlyPool.connect(treasury).reinit({ gasLimit: 1_000_000 })
    );
    const marginCallEvent = txReceipt.events?.find((e) => e.event == 'EnactMarginCall');
    if (marginCallEvent) {
      logger.warn(`Margin call happened at day ${i} (${nextDate} time)`);
      logger.warn(`mc account: ${marginCallEvent.args![0]}`);
    }

    //check coefficients
    const lastReinitTimestampSeconds = BigNumber.from(await marginlyPool.lastReinitTimestampSeconds());
    const baseCollateralCoeff = BigNumber.from(await marginlyPool.baseCollateralCoeff());
    const quoteCollateralCoeff = BigNumber.from(await marginlyPool.quoteCollateralCoeff());
    const baseDebtCoeff = BigNumber.from(await marginlyPool.baseDebtCoeff());
    const discountedBaseDebt = BigNumber.from(await marginlyPool.discountedBaseDebt());
    const discountedBaseCollateral = BigNumber.from(await marginlyPool.discountedBaseCollateral());
    const discountedQuoteDebt = BigNumber.from(await marginlyPool.discountedQuoteDebt());
    const discountedQuoteCollateral = BigNumber.from(await marginlyPool.discountedQuoteCollateral());

    //lastReinitTimestamp
    const actualSecondsPassed = lastReinitTimestampSeconds.sub(lastReinitTimestampSecondsBefore);

    // baseDebtCoeff
    const baseDebtCoeffMul = powTaylor(
      leverageShortBefore.mul(interestRateX96).div(secondsInYearX96).add(FP96.one),
      +actualSecondsPassed
    );
    const expectedQuoteDebtCoeff = baseDebtCoeffBefore.mul(baseDebtCoeffMul).div(FP96.one);
    assert.deepEqual(expectedQuoteDebtCoeff, baseDebtCoeff);

    if (!marginCallEvent) {
      // baseCollateralCoeff
      const baseDebtDelta = baseDebtCoeff.sub(baseDebtCoeffBefore).mul(discountedBaseDebt).div(FP96.one);

      const baseCollatDelta = baseCollateralCoeff
        .sub(baseCollateralCoeffBefore)
        .mul(discountedBaseCollateral)
        .div(FP96.one);

      // base collateral change == base debt change
      const epsilon = BigNumber.from(1);
      if (!baseDebtDelta.sub(baseCollateralCoeff).abs().gt(epsilon)) {
        logger.warn(`quoteDebtDelta: ${formatUnits(baseDebtDelta, 18)} WETH`);
        logger.warn(`quoteCollatDelta: ${formatUnits(baseCollatDelta, 18)} WETH`);
        logger.error(`they must be equal`);
      }

      let lendersTotalBaseDelta = BigNumber.from(0);
      let shortersTotalBaseDelta = BigNumber.from(0);

      for (let i = 0; i < lendersNumber; ++i) {
        const position = await marginlyPool.positions(lenders[i].address);
        const discountedBaseAmount = BigNumber.from(position.discountedBaseAmount);
        const realBaseAmount = baseCollateralCoeff.mul(discountedBaseAmount).div(FP96.one);
        lendersTotalBaseDelta = lendersTotalBaseDelta.add(realBaseAmount).sub(baseAmountsLenders[i]);
        baseAmountsLenders[i] = realBaseAmount;
      }

      for (let i = 0; i < shortersNumber; ++i) {
        const position = await marginlyPool.positions(shorters[i].address);
        if (position._type == 0) {
          continue; //skip margin called positions
        }

        const leverage = await getShortSortKeyX48(marginlyPool, shorters[i].address);
        const discountedBaseAmount = BigNumber.from(position.discountedBaseAmount);
        const debtCoeff = BigNumber.from(await marginlyPool.baseDebtCoeff());
        const realBaseAmount = debtCoeff.mul(discountedBaseAmount).div(FP96.one);
        shortersTotalBaseDelta = shortersTotalBaseDelta.add(realBaseAmount).sub(baseDebtsShorters[i]);
        baseDebtsShorters[i] = realBaseAmount;
      }

      if (
        lendersTotalBaseDelta
          .sub(shortersTotalBaseDelta)
          .abs()
          .gt(epsilon.mul(BigNumber.from(shortersNumber)))
      ) {
        const lendersDelta = formatUnits(lendersTotalBaseDelta, 18);
        const shortersDelta = formatUnits(shortersTotalBaseDelta, 18);
        logger.warn(`Day ${i}: lenders delta = ${lendersDelta} != ${shortersDelta} = shorters delta`);
      }
    }
  }

  const quoteCollateralCoeff = BigNumber.from(await marginlyPool.quoteCollateralCoeff());
  const baseCollateralCoeff = BigNumber.from(await marginlyPool.baseCollateralCoeff());

  logger.info(`Check lenders after reinit`);
  for (let i = 0; i < lendersNumber; ++i) {
    logger.info(`${i + 1}) lender ${lenders[i].address}`);
    const position = await marginlyPool.positions(lenders[i].address);

    const discountedBaseAmount = BigNumber.from(position.discountedBaseAmount);
    const realBaseAmount = baseCollateralCoeff.mul(discountedBaseAmount).div(FP96.one);

    logger.info(` Deposit ${formatUnits(baseAmount, 18)} WETH, current ${formatUnits(realBaseAmount, 18)} WETH`);
  }

  console.log(`\n`);
  logger.info(`Check borrowers after reinit`);
  for (let i = 0; i < shortersNumber; ++i) {
    const shorter = shorters[i];
    logger.info(`${i + 1}) shorter ${shorter.address}`);
    const position = await marginlyPool.positions(shorter.address);
    if (position._type == 0) {
      logger.warn(`position not exists`);
      continue;
    }

    const sortKeyX48 = await getShortSortKeyX48(marginlyPool, shorter.address);
    const discountedBaseAmount = BigNumber.from(position.discountedBaseAmount);
    const discountedQuoteAmount = BigNumber.from(position.discountedQuoteAmount);
    const debtCoeff = BigNumber.from(await marginlyPool.baseDebtCoeff());
    const realBaseAmount = debtCoeff.mul(discountedBaseAmount).div(FP96.one);
    const realQuoteAmount = quoteCollateralCoeff.mul(discountedQuoteAmount).div(FP96.one);
    logger.info(` position type ${position._type}`);
    logger.info(` sortKey ${fp48ToHumanString(sortKeyX48)}`);
    logger.info(` collateral ${formatUnits(realQuoteAmount, 6)} USDC, debt ${formatUnits(realBaseAmount, 18)} WETH`);
  }

  return;
}
