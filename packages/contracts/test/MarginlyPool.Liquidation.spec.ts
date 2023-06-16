import { createMarginlyPool, createTimeMoveMarginlyPool, increatePoolTimestamp } from './shared/fixtures';
import { loadFixture } from './shared/mocks';
import { expect } from 'chai';
import { ethers } from './shared/mocks';
import {
  calcAccruedRateCoeffs,
  calcLeverageLong,
  calcLeverageShort,
  calcLongSortKey,
  calcShortSortKey,
  CallType,
  convertFP96ToNumber,
  FP48,
  FP96,
  PositionType,
  powTaylor,
  ZERO_ADDRESS,
} from './shared/utils';
import { BigNumber } from 'ethers';

describe('MarginlyPool.Liquidation', () => {
  it('should revert when existing position trying to make liquidation', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, shorter, depositor] = await ethers.getSigners();

    const amountToDeposit = 100;
    await marginlyPool.connect(depositor).execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS);

    const quoteAmount = 2000;
    const baseAmount = 1000;
    await expect(
      marginlyPool.connect(depositor).execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, shorter.address)
    ).to.be.revertedWith('PI');
  });

  it('should revert when position to liquidation not exists', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, shorter, depositor, receiver] = await ethers.getSigners();

    const amountToDeposit = 100;
    await marginlyPool.connect(depositor).execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS);

    const quoteAmount = 2000;
    const baseAmount = 1000;
    await expect(
      marginlyPool.connect(receiver).execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, shorter.address)
    ).to.be.revertedWith('NL');
  });

  it('should revert when position to liquidation not liquidatable', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, shorter, depositor, receiver] = await ethers.getSigners();

    const depositAmount = 20000;
    await marginlyPool.connect(depositor).execute(CallType.DepositBase, depositAmount, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(depositor).execute(CallType.DepositQuote, depositAmount, 0, false, ZERO_ADDRESS);

    const shorterCollateral = 100;
    const shortAmount = 5000; // leverage 19.9
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, shorterCollateral, shortAmount, false, ZERO_ADDRESS);

    const quoteAmount = 0;
    const baseAmount = 7700; // the sum is enough to cover debt + accruedInterest
    await expect(
      marginlyPool.connect(receiver).execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, shorter.address)
    ).to.be.revertedWith('NL');
  });

  it('should revert when new position after liquidation of short will have bad margin', async () => {
    const { marginlyPool } = await loadFixture(createTimeMoveMarginlyPool);
    const [_, shorter, depositor, receiver] = await ethers.getSigners();

    const depositAmount = 40000;
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositBase, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();

    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositQuote, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();

    const shorterCollateral = 100;
    const shortAmount = 7600; // leverage 19.9
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositQuote, shorterCollateral, shortAmount, false, ZERO_ADDRESS)
    ).wait();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    const quoteAmount = 0;
    const baseAmount = 10;
    await expect(
      marginlyPool.connect(receiver).execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, shorter.address)
    ).to.be.revertedWith('MC');
  });

  it('should revert when new position after liquidation of long will have bad margin', async () => {
    const { marginlyPool } = await loadFixture(createTimeMoveMarginlyPool);
    const [_, longer, depositor, receiver] = await ethers.getSigners();

    const depositAmount = 40000;
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositBase, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositQuote, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();

    const baseCollateral = 100;
    const longAmount = 1980; // leverage 19.8
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(longer).execute(CallType.DepositBase, baseCollateral, longAmount, false, ZERO_ADDRESS)
    ).wait();

    //wait for accrue interest
    const timeShift = 60 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    const quoteAmount = 1;
    const baseAmount = 0;
    await expect(
      marginlyPool.connect(receiver).execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, longer.address)
    ).to.be.revertedWith('MC');
  });

  it('should create new position without debt after short liquidation', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { token0, token1 },
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [_, shorter, depositor, receiver] = await ethers.getSigners();

    const depositAmount = 20000;
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositBase, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositQuote, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();

    const shorterCollateral = 100;
    const shortAmount = 7600; // leverage 19.9
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositQuote, shorterCollateral, shortAmount, false, ZERO_ADDRESS)
    ).wait();

    const beforeLiquidationPosition = await marginlyPool.positions(shorter.address);
    const beforeDiscountedBaseCollateral = await marginlyPool.discountedBaseCollateral();
    const beforeDiscountedQuoteCollateral = await marginlyPool.discountedQuoteCollateral();
    const basePrice = await marginlyPool.getBasePrice();
    const token0BalanceBefore = await token0.balanceOf(marginlyPool.address);
    const token1BalanceBefore = await token1.balanceOf(marginlyPool.address);
    const prevBlockNumber = await marginlyPool.provider.getBlockNumber();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    const quoteAmount = 356;
    const baseAmount = 7700; // the sum is enough to cover debt + accruedInterest
    await (
      await marginlyPool
        .connect(receiver)
        .execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, shorter.address)
    ).wait();

    const expectedCoeffs = await calcAccruedRateCoeffs(marginlyPool, prevBlockNumber);

    const liquidatedPosition = await marginlyPool.positions(shorter.address);
    expect(liquidatedPosition._type).to.be.equal(0);
    expect(liquidatedPosition.discountedBaseAmount).to.be.equal(0);
    expect(liquidatedPosition.discountedQuoteAmount).to.be.equal(0);

    const newPosition = await marginlyPool.positions(receiver.address);
    const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();
    const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();

    expect(newPosition._type).to.be.equal(1); // Lend position
    expect(newPosition.heapPosition).to.be.equal(0);
    const expectedDiscountedQuoteAmountDelta = BigNumber.from(quoteAmount).mul(FP96.one).div(quoteCollateralCoeff);
    expect(newPosition.discountedQuoteAmount).to.be.equal(
      beforeLiquidationPosition.discountedQuoteAmount.add(expectedDiscountedQuoteAmountDelta)
    );

    const expectedDiscountedBaseAmount = BigNumber.from(baseAmount)
      .mul(FP96.one)
      .div(baseCollateralCoeff)
      .sub(beforeLiquidationPosition.discountedBaseAmount);
    expect(newPosition.discountedBaseAmount).to.be.equal(expectedDiscountedBaseAmount);

    //assert aggregates
    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(0);
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(0);

    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(0);
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(0);
    expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(
      beforeDiscountedBaseCollateral.add(newPosition.discountedBaseAmount).add(expectedCoeffs.discountedBaseDebtFee)
    );
    expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(
      beforeDiscountedQuoteCollateral.add(expectedDiscountedQuoteAmountDelta)
    );

    const expectedLongLeverageX96 = calcLeverageLong(
      basePrice.inner,
      await marginlyPool.quoteDebtCoeff(),
      await marginlyPool.baseCollateralCoeff(),
      await marginlyPool.discountedQuoteDebt(),
      await marginlyPool.discountedBaseCollateral()
    );
    expect((await marginlyPool.systemLeverage()).longX96).to.be.equal(expectedLongLeverageX96);

    const expectedShortLeverageX96 = calcLeverageShort(
      basePrice.inner,
      await marginlyPool.quoteCollateralCoeff(),
      await marginlyPool.baseDebtCoeff(),
      await marginlyPool.discountedQuoteCollateral(),
      await marginlyPool.discountedBaseDebt()
    );
    expect((await marginlyPool.systemLeverage()).shortX96).to.be.equal(expectedShortLeverageX96);
    expect(await token0.balanceOf(marginlyPool.address)).to.be.equal(token0BalanceBefore.add(quoteAmount));
    expect(await token1.balanceOf(marginlyPool.address)).to.be.equal(token1BalanceBefore.add(baseAmount));
  });

  it('should create new position without debt after long liquidation', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { token0, token1 },
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [_, longer, depositor, receiver] = await ethers.getSigners();

    const depositAmount = 40000;
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositBase, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositQuote, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();

    const baseCollateral = 100;
    const longAmount = 1980; // leverage 19.8
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(longer).execute(CallType.DepositBase, baseCollateral, longAmount, false, ZERO_ADDRESS)
    ).wait();

    const beforeLiquidationPosition = await marginlyPool.positions(longer.address);
    const beforeDiscountedBaseCollateral = await marginlyPool.discountedBaseCollateral();
    const beforeDiscountedQuoteCollateral = await marginlyPool.discountedQuoteCollateral();
    const basePrice = await marginlyPool.getBasePrice();
    const token0BalanceBefore = await token0.balanceOf(marginlyPool.address);
    const token1BalanceBefore = await token1.balanceOf(marginlyPool.address);

    //wait for accrue interest
    const timeShift = 60 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    const quoteAmount = 3000;
    const baseAmount = 10;
    await (
      await marginlyPool
        .connect(receiver)
        .execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, longer.address)
    ).wait();

    const liquidatedPosition = await marginlyPool.positions(longer.address);
    expect(liquidatedPosition._type).to.be.equal(0);
    expect(liquidatedPosition.discountedBaseAmount).to.be.equal(0);
    expect(liquidatedPosition.discountedQuoteAmount).to.be.equal(0);

    const newPosition = await marginlyPool.positions(receiver.address);
    const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
    const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();

    expect(newPosition._type).to.be.equal(1); // Lend position
    expect(newPosition.heapPosition).to.be.equal(0);
    const expectedDiscountedBaseAmountDelta = BigNumber.from(baseAmount).mul(FP96.one).div(baseCollateralCoeff);
    expect(newPosition.discountedBaseAmount).to.be.equal(
      beforeLiquidationPosition.discountedBaseAmount.add(expectedDiscountedBaseAmountDelta)
    ); // should receive bad position collateral
    const expectedDiscountedQuoteAmount = BigNumber.from(quoteAmount)
      .mul(FP96.one)
      .div(quoteCollateralCoeff)
      .sub(beforeLiquidationPosition.discountedQuoteAmount);
    expect(newPosition.discountedQuoteAmount).to.be.equal(expectedDiscountedQuoteAmount);

    //assert aggregates
    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(0);
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(0);
    expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(
      beforeDiscountedBaseCollateral.add(expectedDiscountedBaseAmountDelta)
    );
    expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(
      beforeDiscountedQuoteCollateral.add(newPosition.discountedQuoteAmount)
    );

    const expectedLongLeverageX96 = calcLeverageLong(
      basePrice.inner,
      await marginlyPool.quoteDebtCoeff(),
      await marginlyPool.baseCollateralCoeff(),
      await marginlyPool.discountedQuoteDebt(),
      await marginlyPool.discountedBaseCollateral()
    );
    expect(await (await marginlyPool.systemLeverage()).longX96).to.be.equal(expectedLongLeverageX96);

    const expectedShortLeverageX96 = calcLeverageShort(
      basePrice.inner,
      await marginlyPool.quoteCollateralCoeff(),
      await marginlyPool.baseDebtCoeff(),
      await marginlyPool.discountedQuoteCollateral(),
      await marginlyPool.discountedBaseDebt()
    );
    expect((await marginlyPool.systemLeverage()).shortX96).to.be.equal(expectedShortLeverageX96);
    expect(await token0.balanceOf(marginlyPool.address)).to.be.equal(token0BalanceBefore.add(quoteAmount));
    expect(await token1.balanceOf(marginlyPool.address)).to.be.equal(token1BalanceBefore.add(baseAmount));
  });

  it('should create new short position after short liquidation', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { token0, token1 },
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [_, shorter, depositor, receiver] = await ethers.getSigners();

    const depositAmount = 20000;
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositBase, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositQuote, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();

    const shorterCollateral = 100;
    const shortAmount = 7600; // leverage 19.9
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositQuote, shorterCollateral, shortAmount, false, ZERO_ADDRESS)
    ).wait();

    const beforeLiquidationPosition = await marginlyPool.positions(shorter.address);
    const beforeDiscountedBaseCollateral = await marginlyPool.discountedBaseCollateral();
    const basePrice = await marginlyPool.getBasePrice();
    const token0BalanceBefore = await token0.balanceOf(marginlyPool.address);
    const token1BalanceBefore = await token1.balanceOf(marginlyPool.address);
    const prevBlockNumber = await marginlyPool.provider.getBlockNumber();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    const quoteAmount = 1000; // the sum is enough to improve position leverage
    const baseAmount = 100; // the sum is not enough to cover debt + accruedInterest
    await (
      await marginlyPool
        .connect(receiver)
        .execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, shorter.address)
    ).wait();

    const expectedCoeffs = await calcAccruedRateCoeffs(marginlyPool, prevBlockNumber);

    const liquidatedPosition = await marginlyPool.positions(shorter.address);
    expect(liquidatedPosition._type).to.be.equal(0);
    expect(liquidatedPosition.discountedBaseAmount).to.be.equal(0);
    expect(liquidatedPosition.discountedQuoteAmount).to.be.equal(0);

    const newPosition = await marginlyPool.positions(receiver.address);
    const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();

    expect(newPosition._type).to.be.equal(2); // Short position
    expect(newPosition.heapPosition).to.be.equal(1);

    const expectedQuoteAmount = BigNumber.from(quoteAmount)
      .mul(FP96.one)
      .div(quoteCollateralCoeff)
      .add(beforeLiquidationPosition.discountedQuoteAmount);
    expect(newPosition.discountedQuoteAmount).to.be.equal(expectedQuoteAmount); // should receive bad position collateral
    const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();
    const expectedDiscountedBaseAmount = beforeLiquidationPosition.discountedBaseAmount.sub(
      BigNumber.from(baseAmount).mul(FP96.one).div(baseCollateralCoeff)
    );
    expect(newPosition.discountedBaseAmount).to.be.equal(expectedDiscountedBaseAmount); // should receive bad position debt

    //assert aggregates
    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(expectedDiscountedBaseAmount);
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(0);
    expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(
      beforeDiscountedBaseCollateral.add(expectedCoeffs.discountedBaseDebtFee)
    );
    expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedQuoteAmount.add(depositAmount));

    const expectedLongLeverageX96 = calcLeverageLong(
      basePrice.inner,
      await marginlyPool.quoteDebtCoeff(),
      await marginlyPool.baseCollateralCoeff(),
      await marginlyPool.discountedQuoteDebt(),
      await marginlyPool.discountedBaseCollateral()
    );
    expect(await (await marginlyPool.systemLeverage()).longX96).to.be.equal(expectedLongLeverageX96);

    const expectedShortLeverageX96 = calcLeverageShort(
      basePrice.inner,
      await marginlyPool.quoteCollateralCoeff(),
      await marginlyPool.baseDebtCoeff(),
      await marginlyPool.discountedQuoteCollateral(),
      await marginlyPool.discountedBaseDebt()
    );
    expect((await marginlyPool.systemLeverage()).shortX96).to.be.equal(expectedShortLeverageX96);
    expect(await token0.balanceOf(marginlyPool.address)).to.be.equal(token0BalanceBefore.add(quoteAmount));
    expect(await token1.balanceOf(marginlyPool.address)).to.be.equal(token1BalanceBefore.add(baseAmount));
  });

  it('should create new long position after long liquidation', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { token0, token1 },
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [_, longer, depositor, receiver] = await ethers.getSigners();

    const depositAmount = 40000;
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositBase, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(depositor).execute(CallType.DepositQuote, depositAmount, 0, false, ZERO_ADDRESS)
    ).wait();

    const baseCollateral = 100;
    const longAmount = 1980; // leverage 19.8
    await increatePoolTimestamp(marginlyPool, 1);
    await (
      await marginlyPool.connect(longer).execute(CallType.DepositBase, baseCollateral, longAmount, false, ZERO_ADDRESS)
    ).wait();

    const beforeLiquidationPosition = await marginlyPool.positions(longer.address);
    const beforeDiscountedQuoteCollateral = await marginlyPool.discountedQuoteCollateral();
    const basePrice = await marginlyPool.getBasePrice();
    const token0BalanceBefore = await token0.balanceOf(marginlyPool.address);
    const token1BalanceBefore = await token1.balanceOf(marginlyPool.address);
    const prevBlockNumber = await marginlyPool.provider.getBlockNumber();

    //wait for accrue interest
    const timeShift = 160 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    const quoteAmount = 20; // the sum is not enough to cover bad position debt
    const baseAmount = 10;
    await (
      await marginlyPool
        .connect(receiver)
        .execute(CallType.ReceivePosition, quoteAmount, baseAmount, false, longer.address)
    ).wait();

    const expectedCoeffs = await calcAccruedRateCoeffs(marginlyPool, prevBlockNumber);

    const liquidatedPosition = await marginlyPool.positions(longer.address);
    expect(liquidatedPosition._type).to.be.equal(0);
    expect(liquidatedPosition.discountedBaseAmount).to.be.equal(0);
    expect(liquidatedPosition.discountedQuoteAmount).to.be.equal(0);

    const newPosition = await marginlyPool.positions(receiver.address);
    const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
    const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();

    expect(newPosition._type).to.be.equal(3); // Long position
    expect(newPosition.heapPosition).to.be.equal(1);
    const expectedBaseAmount = BigNumber.from(baseAmount)
      .mul(FP96.one)
      .div(baseCollateralCoeff)
      .add(beforeLiquidationPosition.discountedBaseAmount);
    expect(newPosition.discountedBaseAmount).to.be.equal(expectedBaseAmount); // should receive bad position collateral

    const expectedDiscountedQuoteAmount = beforeLiquidationPosition.discountedQuoteAmount.sub(
      BigNumber.from(quoteAmount).mul(FP96.one).div(quoteCollateralCoeff)
    );
    expect(newPosition.discountedQuoteAmount).to.be.equal(expectedDiscountedQuoteAmount);

    //TODO: check aggregates discountedDebt, discountedCollateral, systemLeverage, balance of pool should increase
    //assert aggregates
    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(0);
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(expectedDiscountedQuoteAmount);
    expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedBaseAmount.add(depositAmount));
    expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(
      beforeDiscountedQuoteCollateral.add(expectedCoeffs.discountedQuoteDebtFee)
    );

    const expectedLongLeverageX96 = calcLeverageLong(
      basePrice.inner,
      await marginlyPool.quoteDebtCoeff(),
      await marginlyPool.baseCollateralCoeff(),
      await marginlyPool.discountedQuoteDebt(),
      await marginlyPool.discountedBaseCollateral()
    );
    expect(await (await marginlyPool.systemLeverage()).longX96).to.be.equal(expectedLongLeverageX96);

    const expectedShortLeverageX96 = calcLeverageShort(
      basePrice.inner,
      await marginlyPool.quoteCollateralCoeff(),
      await marginlyPool.baseDebtCoeff(),
      await marginlyPool.discountedQuoteCollateral(),
      await marginlyPool.discountedBaseDebt()
    );
    expect((await marginlyPool.systemLeverage()).shortX96).to.be.equal(expectedShortLeverageX96);
    expect(await token0.balanceOf(marginlyPool.address)).to.be.equal(token0BalanceBefore.add(quoteAmount));
    expect(await token1.balanceOf(marginlyPool.address)).to.be.equal(token1BalanceBefore.add(baseAmount));
  });
});

describe('mc heap tests', () => {
  it('remove long caller', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, depositor, longer1, longer2, longer3] = await ethers.getSigners();
    const depositAmount = 1000;

    await marginlyPool.connect(depositor).execute(CallType.DepositQuote, 1000 * depositAmount, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(longer1).execute(CallType.DepositBase, depositAmount, 18500, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer2).execute(CallType.DepositBase, depositAmount, 18400, false, ZERO_ADDRESS);
    await marginlyPool.connect(longer3).execute(CallType.DepositBase, depositAmount, 18300, false, ZERO_ADDRESS);

    expect((await marginlyPool.getLongHeapPosition(0))[1].account).to.be.equal(longer1.address);
    expect((await marginlyPool.getLongHeapPosition(1))[1].account).to.be.equal(longer2.address);
    expect((await marginlyPool.getLongHeapPosition(2))[1].account).to.be.equal(longer3.address);

    await time.increase(24 * 60 * 60);

    // should happen 2 MCs: longer1 as as the one with the worst leverage and longer3 as the caller with bad leverage
    await marginlyPool.connect(longer3).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    expect((await marginlyPool.getLongHeapPosition(0))[1].account).to.be.equal(longer2.address);
    expect((await marginlyPool.getLongHeapPosition(1))[1].account).to.be.equal(ZERO_ADDRESS);
  });

  it('remove short caller', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, depositor, shorter1, shorter2, shorter3] = await ethers.getSigners();
    const depositAmount = +(await marginlyPool.getBasePrice()).inner.mul(1000).div(FP96.one);

    await marginlyPool.connect(depositor).execute(CallType.DepositBase, 1000 * depositAmount, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(shorter1).execute(CallType.DepositQuote, depositAmount, 18500, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter2).execute(CallType.DepositQuote, depositAmount, 18400, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorter3).execute(CallType.DepositQuote, depositAmount, 18300, false, ZERO_ADDRESS);

    expect((await marginlyPool.getShortHeapPosition(0))[1].account).to.be.equal(shorter1.address);
    expect((await marginlyPool.getShortHeapPosition(1))[1].account).to.be.equal(shorter2.address);
    expect((await marginlyPool.getShortHeapPosition(2))[1].account).to.be.equal(shorter3.address);

    await time.increase(24 * 60 * 60);

    // should happen 2 MCs: shorter1 as the one with the worst leverage and shorter3 as the caller with bad leverage
    await marginlyPool.connect(shorter3).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    expect((await marginlyPool.getShortHeapPosition(0))[1].account).to.be.equal(shorter2.address);
    expect((await marginlyPool.getShortHeapPosition(1))[1].account).to.be.equal(ZERO_ADDRESS);
  });
});
