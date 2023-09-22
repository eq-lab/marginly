import { createMarginlyPool, getDeleveragedPool } from './shared/fixtures';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  CallType,
  FP96,
  paramsDefaultLeverageWithoutIr,
  paramsLowLeverageWithoutIr,
  ZERO_ADDRESS,
  uniswapV3Swapdata,
} from './shared/utils';
import { BigNumber } from 'ethers';

describe('Deleverage', () => {
  it('Deleverage long position', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(createMarginlyPool);

    await marginlyPool.connect(factoryOwner).setParameters(paramsDefaultLeverageWithoutIr);

    const price = (await marginlyPool.getBasePrice()).inner;

    const accounts = await ethers.getSigners();

    const lender = accounts[0];
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 10000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 10000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const longer = accounts[1];
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 18000, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const shorter = accounts[2];

    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 100000, 20000, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();
    const discountedBaseCollateral = await marginlyPool.discountedBaseCollateral();
    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
    const discountedBaseDebt = await marginlyPool.discountedBaseDebt();
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
    const discountedQuoteCollateral = await marginlyPool.discountedQuoteCollateral();
    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();

    const posDisColl = (await marginlyPool.positions(longer.address)).discountedBaseAmount;
    const posDisDebt = (await marginlyPool.positions(longer.address)).discountedQuoteAmount;

    await marginlyPool.connect(factoryOwner).setParameters(paramsLowLeverageWithoutIr);
    await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const poolBaseBalance = baseCollCoeff
      .mul(discountedBaseCollateral)
      .sub(baseDebtCoeff.mul(discountedBaseDebt))
      .div(FP96.one);

    const longerPosition = await marginlyPool.positions(longer.address);

    expect(longerPosition._type).to.be.equal(0);
    expect(longerPosition.discountedBaseAmount).to.be.equal(0);
    expect(longerPosition.discountedQuoteAmount).to.be.equal(0);

    const quoteDelevCoeffAfter = await marginlyPool.quoteDelevCoeff();
    const baseDebtCoeffAfter = await marginlyPool.baseDebtCoeff();

    const posRealColl = baseCollCoeff.mul(posDisColl).div(FP96.one);
    const baseDeleverageAmount = posRealColl.sub(poolBaseBalance);
    const quoteDeleverageAmount = baseDeleverageAmount.mul(price).div(FP96.one);

    expect(baseDebtCoeffAfter).to.be.equal(
      baseDebtCoeff.sub(baseDeleverageAmount.mul(FP96.one).div(discountedBaseDebt))
    );

    const posQuoteDebtAfterDelev = quoteDebtCoeff.mul(posDisDebt).div(FP96.one).sub(quoteDeleverageAmount);
    const posBaseCollBeforeMC = posRealColl.sub(baseDeleverageAmount);
    const quoteDelta = posBaseCollBeforeMC.mul(price).div(FP96.one).sub(posQuoteDebtAfterDelev);

    const poolQuoteCollAfterDelev = quoteCollCoeff
      .mul(discountedQuoteCollateral)
      .div(FP96.one)
      .sub(quoteDeleverageAmount);

    const quoteDelevCoeffAfterDelev = quoteDeleverageAmount.mul(FP96.one).div(discountedBaseDebt);

    const factor = quoteDelta.mul(FP96.one).div(poolQuoteCollAfterDelev).add(FP96.one);

    const resQuoteDelevCoeff = quoteDelevCoeffAfterDelev.mul(factor).div(FP96.one);

    expect(quoteDelevCoeffAfter).to.be.equal(resQuoteDelevCoeff);
  });

  it('Deleverage short position', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(createMarginlyPool);

    await marginlyPool.connect(factoryOwner).setParameters(paramsDefaultLeverageWithoutIr);
    const price = (await marginlyPool.getBasePrice()).inner;

    const accounts = await ethers.getSigners();

    const lender = accounts[0];
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 10000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const shorter = accounts[1];
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 100, 7200, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const longer = accounts[2];
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 10000, 8000, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();
    const discountedQuoteCollateral = await marginlyPool.discountedQuoteCollateral();
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
    const discountedQuoteDebt = await marginlyPool.discountedQuoteDebt();
    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
    const discountedBaseCollateral = await marginlyPool.discountedBaseCollateral();
    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();

    const posDisColl = (await marginlyPool.positions(shorter.address)).discountedQuoteAmount;
    const posDisDebt = (await marginlyPool.positions(shorter.address)).discountedBaseAmount;

    await marginlyPool.connect(factoryOwner).setParameters(paramsLowLeverageWithoutIr);
    await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const poolQuoteBalance = quoteCollCoeff
      .mul(discountedQuoteCollateral)
      .sub(quoteDebtCoeff.mul(discountedQuoteDebt))
      .div(FP96.one);

    const shorterPosition = await marginlyPool.positions(shorter.address);

    expect(shorterPosition._type).to.be.equal(0);
    expect(shorterPosition.discountedBaseAmount).to.be.equal(0);
    expect(shorterPosition.discountedQuoteAmount).to.be.equal(0);

    const baseDelevCoeffAfter = await marginlyPool.baseDelevCoeff();
    const quoteDebtCoeffAfter = await marginlyPool.quoteDebtCoeff();

    const posRealColl = quoteCollCoeff.mul(posDisColl).div(FP96.one);
    const quoteDeleverageAmount = posRealColl.sub(poolQuoteBalance);
    const baseDeleverageAmount = quoteDeleverageAmount.mul(FP96.one).div(price);

    expect(quoteDebtCoeffAfter).to.be.equal(
      quoteDebtCoeff.sub(quoteDeleverageAmount.mul(FP96.one).div(discountedQuoteDebt))
    );

    const posBaseDebtAfterDelev = baseDebtCoeff.mul(posDisDebt).div(FP96.one).sub(baseDeleverageAmount);
    const posQuoteCollBeforeMC = posRealColl.sub(quoteDeleverageAmount);
    const baseDelta = posQuoteCollBeforeMC.mul(FP96.one).div(price).sub(posBaseDebtAfterDelev);

    const poolBaseCollAfterDelev = baseCollCoeff.mul(discountedBaseCollateral).div(FP96.one).sub(baseDeleverageAmount);

    const baseDelevCoeffAfterDelev = baseDeleverageAmount.mul(FP96.one).div(discountedQuoteDebt);

    const factor = baseDelta.mul(FP96.one).div(poolBaseCollAfterDelev).add(FP96.one);

    const resBaseDelevCoeff = baseDelevCoeffAfterDelev.mul(factor).div(FP96.one);

    expect(baseDelevCoeffAfter).to.be.closeTo(resBaseDelevCoeff, baseDelevCoeffAfter.div(1000));
  });

  it('short call after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, shorter] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionBefore = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralBefore = await marginlyPool.discountedQuoteCollateral();

    const shortAmount = 1000;
    await marginlyPool
      .connect(shorter)
      .execute(CallType.Short, shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();
    const quoteDelevCoeff = await marginlyPool.quoteDelevCoeff();
    const positionAfter = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralAfter = await marginlyPool.discountedQuoteCollateral();

    const quoteCollDelta = price
      .mul(shortAmount)
      .div(quoteCollCoeff)
      .add(quoteDelevCoeff.mul(shortAmount).mul(FP96.one).div(baseDebtCoeff).div(quoteCollCoeff));

    const posQuoteCollDelta = positionAfter.discountedQuoteAmount.sub(positionBefore.discountedQuoteAmount);
    expect(posQuoteCollDelta).to.be.equal(quoteCollDelta);

    const totalQuoteCollDelta = disQuoteCollateralAfter.sub(disQuoteCollateralBefore);
    expect(totalQuoteCollDelta).to.be.equal(quoteCollDelta);
  });

  it('long call after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, longer] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionBefore = await marginlyPool.positions(longer.address);
    const disBaseCollateralBefore = await marginlyPool.discountedBaseCollateral();

    const longAmount = 1000;
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();
    const baseDelevCoeff = await marginlyPool.baseDelevCoeff();
    const positionAfter = await marginlyPool.positions(longer.address);
    const disBaseCollateralAfter = await marginlyPool.discountedBaseCollateral();

    const baseCollDelta = BigNumber.from(longAmount)
      .mul(FP96.one)
      .div(baseCollCoeff)
      .add(
        baseDelevCoeff.mul(price).div(FP96.one).mul(longAmount).div(quoteDebtCoeff).mul(FP96.one).div(baseCollCoeff)
      );

    const posBaseCollDelta = positionAfter.discountedBaseAmount.sub(positionBefore.discountedBaseAmount);
    expect(posBaseCollDelta).to.be.closeTo(baseCollDelta, 1);

    const totalBaseCollDelta = disBaseCollateralAfter.sub(disBaseCollateralBefore);
    expect(totalBaseCollDelta).to.be.closeTo(baseCollDelta, 1);
  });

  it('depositQuote call after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, shorter] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const shortAmount = 1000;
    await marginlyPool
      .connect(shorter)
      .execute(CallType.Short, shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionBefore = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralBefore = await marginlyPool.discountedQuoteCollateral();

    const quoteDepositAmount = 500;
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, quoteDepositAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralAfter = await marginlyPool.discountedQuoteCollateral();
    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();
    const quoteCollDelta = BigNumber.from(quoteDepositAmount).mul(FP96.one).div(quoteCollCoeff);

    const posQuoteCollDelta = positionAfter.discountedQuoteAmount.sub(positionBefore.discountedQuoteAmount);
    expect(posQuoteCollDelta).to.be.equal(quoteCollDelta);

    const totalQuoteCollDelta = disQuoteCollateralAfter.sub(disQuoteCollateralBefore);
    expect(totalQuoteCollDelta).to.be.equal(quoteCollDelta);
  });

  it('depositBase call after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, longer] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const longAmount = 1000;
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionBefore = await marginlyPool.positions(longer.address);
    const disBaseCollateralBefore = await marginlyPool.discountedBaseCollateral();

    const baseDepositAmount = 500;
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, baseDepositAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(longer.address);
    const disBaseCollateralAfter = await marginlyPool.discountedBaseCollateral();
    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();
    const baseCollDelta = BigNumber.from(baseDepositAmount).mul(FP96.one).div(baseCollCoeff);

    const posBaseCollDelta = positionAfter.discountedBaseAmount.sub(positionBefore.discountedBaseAmount);
    expect(posBaseCollDelta).to.be.equal(baseCollDelta);

    const totalBaseCollDelta = disBaseCollateralAfter.sub(disBaseCollateralBefore);
    expect(totalBaseCollDelta).to.be.equal(baseCollDelta);
  });

  it('withdrawQuote call after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, shorter] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const shortAmount = 1000;
    await marginlyPool
      .connect(shorter)
      .execute(CallType.Short, shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionBefore = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralBefore = await marginlyPool.discountedQuoteCollateral();

    const quoteAmountWithdrawn = 500;
    await marginlyPool
      .connect(shorter)
      .execute(CallType.WithdrawQuote, quoteAmountWithdrawn, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralAfter = await marginlyPool.discountedQuoteCollateral();
    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();
    const quoteCollDelta = BigNumber.from(quoteAmountWithdrawn).mul(FP96.one).div(quoteCollCoeff);

    const posQuoteCollDelta = positionBefore.discountedQuoteAmount.sub(positionAfter.discountedQuoteAmount);
    expect(posQuoteCollDelta).to.be.equal(quoteCollDelta);

    const totalQuoteCollDelta = disQuoteCollateralBefore.sub(disQuoteCollateralAfter);
    expect(totalQuoteCollDelta).to.be.equal(quoteCollDelta);
  });

  it('withdrawBase call after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, longer] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const longAmount = 1000;
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionBefore = await marginlyPool.positions(longer.address);
    const disBaseCollateralBefore = await marginlyPool.discountedBaseCollateral();

    const baseAmountWithdrawn = 500;
    await marginlyPool
      .connect(longer)
      .execute(CallType.WithdrawBase, baseAmountWithdrawn, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(longer.address);
    const disBaseCollateralAfter = await marginlyPool.discountedBaseCollateral();
    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();
    const baseCollDelta = BigNumber.from(baseAmountWithdrawn).mul(FP96.one).div(baseCollCoeff);

    const posBaseCollDelta = positionBefore.discountedBaseAmount.sub(positionAfter.discountedBaseAmount);
    expect(posBaseCollDelta).to.be.equal(baseCollDelta);

    const totalBaseCollDelta = disBaseCollateralBefore.sub(disBaseCollateralAfter);
    expect(totalBaseCollDelta).to.be.equal(baseCollDelta);
  });

  it('close long position after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, longer] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const longAmount = 1000;
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionBefore = await marginlyPool.positions(longer.address);
    const disBaseCollateralBefore = await marginlyPool.discountedBaseCollateral();
    const disQuoteDebtBefore = await marginlyPool.discountedQuoteDebt();

    await time.increase(10 * 24 * 60 * 60);
    // 99% of a price as limit is used to avoid precision issues in calculations
    await marginlyPool
      .connect(longer)
      .execute(CallType.ClosePosition, 0, 0, price.mul(99).div(100), false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(longer.address);

    expect(positionAfter.discountedQuoteAmount).to.be.equal(0);
    const disQuoteDebtAfter = await marginlyPool.discountedQuoteDebt();
    const totalQuoteDebtDelta = disQuoteDebtBefore.sub(disQuoteDebtAfter);
    expect(totalQuoteDebtDelta).to.be.equal(positionBefore.discountedQuoteAmount);

    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();
    const baseDelevCoeff = await marginlyPool.baseDelevCoeff();
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();

    // posBefore.discountedQuoteAmount * quoteDebtCoeff / price
    const realCollDelta = positionBefore.discountedQuoteAmount.mul(quoteDebtCoeff).div(price);
    // (realCollDelta + pos.discountedQuoteAmount * baseDelevCoeff) / baseCollCoeff
    const disBaseCollDelta = realCollDelta
      .add(positionBefore.discountedQuoteAmount.mul(baseDelevCoeff).div(FP96.one))
      .mul(FP96.one)
      .div(baseCollCoeff);

    const disBaseCollateralAfter = await marginlyPool.discountedBaseCollateral();

    const posBaseCollDelta = positionBefore.discountedBaseAmount.sub(positionAfter.discountedBaseAmount);
    expect(posBaseCollDelta).to.be.closeTo(disBaseCollDelta, 1);

    const totalBaseCollDelta = disBaseCollateralBefore.sub(disBaseCollateralAfter);
    expect(totalBaseCollDelta).to.be.closeTo(disBaseCollDelta, 1);
  });

  it('close short position after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, shorter] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const shortAmount = 1000;
    await marginlyPool
      .connect(shorter)
      .execute(CallType.Short, shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionBefore = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralBefore = await marginlyPool.discountedQuoteCollateral();
    const disBaseDebtBefore = await marginlyPool.discountedBaseDebt();

    await time.increase(10 * 24 * 60 * 60);
    await marginlyPool
      .connect(shorter)
      .execute(CallType.ClosePosition, 0, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(shorter.address);

    expect(positionAfter.discountedBaseAmount).to.be.equal(0);
    const disBaseDebtAfter = await marginlyPool.discountedBaseDebt();
    const totalBaseDebtDelta = disBaseDebtBefore.sub(disBaseDebtAfter);
    expect(totalBaseDebtDelta).to.be.equal(positionBefore.discountedBaseAmount);

    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();
    const quoteDelevCoeff = await marginlyPool.quoteDelevCoeff();
    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();

    const realCollDelta = positionBefore.discountedBaseAmount.mul(baseDebtCoeff).div(FP96.one).mul(price).div(FP96.one);
    // (realCollDelta + pos.discountedBaseAmount * quoteDelevCoeff) / quoteCollCoeff
    const disQuoteCollDelta = realCollDelta
      .add(positionBefore.discountedBaseAmount.mul(quoteDelevCoeff).div(FP96.one))
      .mul(FP96.one)
      .div(quoteCollCoeff);

    const disQuoteCollateralAfter = await marginlyPool.discountedQuoteCollateral();

    const posQuoteCollDelta = positionBefore.discountedQuoteAmount.sub(positionAfter.discountedQuoteAmount);
    expect(posQuoteCollDelta).to.be.equal(disQuoteCollDelta);

    const totalQuoteCollDelta = disQuoteCollateralBefore.sub(disQuoteCollateralAfter);
    expect(totalQuoteCollDelta).to.be.equal(disQuoteCollDelta);
  });
});
