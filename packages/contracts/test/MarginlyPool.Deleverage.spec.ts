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
  PositionType,
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
    console.log(`price is ${price}`);

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
    expect(posBaseCollDelta).to.be.closeTo(disBaseCollDelta, 2);

    const totalBaseCollDelta = disBaseCollateralBefore.sub(disBaseCollateralAfter);
    expect(totalBaseCollDelta).to.be.closeTo(disBaseCollDelta, 2);
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

  it('receive short position after deleverage, decreasing debt', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(getDeleveragedPool);

    const [_, lender, shorter, liquidator] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    const params = (await marginlyPool.params());

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const depositQuoteAmount = 1000;
    // (quoteDeposit + price * shortAmount) / quoteDeposit = (maxLev - 1)
    // shortAmount = (maxLev - 2) * quoteDeposit / price
    const shortAmount = BigNumber.from(params.maxLeverage - 2).mul(depositQuoteAmount).mul(FP96.one).div(price);
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, depositQuoteAmount, shortAmount, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    let newParams = {...params};
    newParams.maxLeverage /= 2;
    await marginlyPool.connect(factoryOwner).setParameters(newParams);

    const positionBefore = await marginlyPool.positions(shorter.address);
    const baseDebtBefore = await marginlyPool.discountedBaseDebt();
    const quoteDebtBefore = await marginlyPool.discountedQuoteDebt();
    const quoteCollBefore = await marginlyPool.discountedQuoteCollateral();
    const baseCollBefore = await marginlyPool.discountedBaseCollateral();

    const receiveBaseAmount = BigNumber.from(shortAmount).mul(3).div(4);
    await marginlyPool
      .connect(liquidator)
      .execute(CallType.ReceivePosition, 0, receiveBaseAmount, price, false, shorter.address, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(liquidator.address);
    expect(positionAfter._type).to.be.eq(PositionType.Short);

    const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
    const quoteDelevCoeff = await marginlyPool.quoteDelevCoeff();
    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();

    const quoteCollAfter = await marginlyPool.discountedQuoteCollateral();
    const quoteDebtAfter = await marginlyPool.discountedQuoteDebt();
    const baseDebtAfter = await marginlyPool.discountedBaseDebt();
    const baseCollAfter = await marginlyPool.discountedBaseCollateral();

    expect(quoteDebtBefore).to.be.eq(quoteDebtAfter);
    expect(baseCollBefore).to.be.eq(baseCollAfter);

    const realBaseDebtBefore = baseDebtCoeff.mul(baseDebtBefore).div(FP96.one);
    const realBaseDebtAfter = baseDebtCoeff.mul(baseDebtAfter).div(FP96.one);
    expect(
      realBaseDebtBefore.sub(realBaseDebtAfter)
    ).to.be.closeTo(receiveBaseAmount, receiveBaseAmount.div(1000));

    const posRealBaseDebtBefore = baseDebtCoeff.mul(positionBefore.discountedBaseAmount).div(FP96.one);
    const posRealBaseDebtAfter = baseDebtCoeff.mul(positionAfter.discountedBaseAmount).div(FP96.one);
    expect(
      posRealBaseDebtBefore.sub(posRealBaseDebtAfter)
    ).to.be.closeTo(receiveBaseAmount, receiveBaseAmount.div(1000));

    const realQuoteCollBefore = quoteCollateralCoeff.mul(quoteCollBefore).div(FP96.one).sub(
      quoteDelevCoeff.mul(baseDebtBefore).div(FP96.one)
    );
    const realQuoteCollAfter = quoteCollateralCoeff.mul(quoteCollAfter).div(FP96.one).sub(
      quoteDelevCoeff.mul(baseDebtAfter).div(FP96.one)
    );
    expect(realQuoteCollBefore).to.be.closeTo(realQuoteCollAfter, realQuoteCollAfter.div(1000));

    const posRealQuoteCollBefore = quoteCollateralCoeff.mul(positionBefore.discountedQuoteAmount).div(FP96.one).sub(
      quoteDelevCoeff.mul(positionBefore.discountedBaseAmount).div(FP96.one)
    );
    const posRealQuoteCollAfter = quoteCollateralCoeff.mul(positionAfter.discountedQuoteAmount).div(FP96.one).sub(
      quoteDelevCoeff.mul(positionAfter.discountedBaseAmount).div(FP96.one)
    );
    expect(posRealQuoteCollBefore).to.be.closeTo(posRealQuoteCollAfter, posRealQuoteCollAfter.div(1000));
  });

  it('receive long position after deleverage, decreasing debt', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(getDeleveragedPool);

    const [_, lender, longer, liquidator] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    const params = (await marginlyPool.params());

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const depositBaseAmount = 1000;
    // (baseDeposit + longAmount) / baseDeposit = (maxLev - 1)
    // shortAmount = (maxLev - 2) * quoteDeposit
    const longAmount = BigNumber.from(params.maxLeverage - 2).mul(depositBaseAmount);
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, depositBaseAmount, longAmount, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    let newParams = {...params};
    newParams.maxLeverage /= 2;
    await marginlyPool.connect(factoryOwner).setParameters(newParams);

    const positionBefore = await marginlyPool.positions(longer.address);
    const quoteDebtBefore = await marginlyPool.discountedQuoteDebt();
    const baseDebtBefore = await marginlyPool.discountedBaseDebt();
    const quoteCollBefore = await marginlyPool.discountedQuoteCollateral();
    const baseCollBefore = await marginlyPool.discountedBaseCollateral();

    const receiveQuoteAmount = price.mul(longAmount).mul(3).div(4).div(FP96.one);
    await marginlyPool
      .connect(liquidator)
      .execute(CallType.ReceivePosition, receiveQuoteAmount, 0, price, false, longer.address, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(liquidator.address);
    expect(positionAfter._type).to.be.eq(PositionType.Long);

    const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();
    const baseDelevCoeff = await marginlyPool.baseDelevCoeff();
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();

    const baseCollAfter = await marginlyPool.discountedBaseCollateral();
    const baseDebtAfter = await marginlyPool.discountedBaseDebt();
    const quoteCollAfter = await marginlyPool.discountedQuoteCollateral();
    const quoteDebtAfter = await marginlyPool.discountedQuoteDebt();

    expect(baseDebtBefore).to.be.eq(baseDebtAfter);
    expect(quoteCollBefore).to.be.eq(quoteCollAfter);

    const realQuoteDebtBefore = quoteDebtCoeff.mul(quoteDebtBefore).div(FP96.one);
    const realQuoteDebtAfter = quoteDebtCoeff.mul(quoteDebtAfter).div(FP96.one);
    expect(
      realQuoteDebtBefore.sub(realQuoteDebtAfter)
    ).to.be.closeTo(receiveQuoteAmount, receiveQuoteAmount.div(1000));

    const posRealQuoteDebtBefore = quoteDebtCoeff.mul(positionBefore.discountedQuoteAmount).div(FP96.one);
    const posRealQuoteDebtAfter = quoteDebtCoeff.mul(positionAfter.discountedQuoteAmount).div(FP96.one);
    expect(
      posRealQuoteDebtBefore.sub(posRealQuoteDebtAfter)
    ).to.be.closeTo(receiveQuoteAmount, receiveQuoteAmount.div(1000));

    const realBaseCollBefore = baseCollateralCoeff.mul(baseCollBefore).div(FP96.one).sub(
      baseDelevCoeff.mul(quoteDebtBefore).div(FP96.one)
    );
    const realBaseCollAfter = baseCollateralCoeff.mul(baseCollAfter).div(FP96.one).sub(
      baseDelevCoeff.mul(quoteDebtAfter).div(FP96.one)
    );
    expect(realBaseCollBefore).to.be.closeTo(realBaseCollAfter, realBaseCollAfter.div(1000));

    const posRealBaseCollBefore = baseCollateralCoeff.mul(positionBefore.discountedBaseAmount).div(FP96.one).sub(
      baseDelevCoeff.mul(positionBefore.discountedQuoteAmount).div(FP96.one)
    );
    const posRealBaseCollAfter = baseCollateralCoeff.mul(positionAfter.discountedBaseAmount).div(FP96.one).sub(
      baseDelevCoeff.mul(positionAfter.discountedQuoteAmount).div(FP96.one)
    );
    expect(posRealBaseCollBefore).to.be.closeTo(posRealBaseCollAfter, posRealBaseCollAfter.div(1000));
  });

  it('receive short position after deleverage, debt fully covered', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(getDeleveragedPool);

    const [_, lender, shorter, liquidator] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    const params = (await marginlyPool.params());
    let newParams = {...params};
    newParams.interestRate = 0;
    newParams.fee = 0;
    newParams.swapFee = 0;
    await marginlyPool.connect(factoryOwner).setParameters(newParams);

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const depositQuoteAmount = 1000;
    // (quoteDeposit + price * shortAmount) / quoteDeposit = (maxLev - 1)
    // shortAmount = (maxLev - 2) * quoteDeposit / price
    const shortAmount = BigNumber.from(params.maxLeverage - 2).mul(depositQuoteAmount).mul(FP96.one).div(price);
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, depositQuoteAmount, shortAmount, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    newParams.maxLeverage /= 2;
    await marginlyPool.connect(factoryOwner).setParameters(newParams);

    const positionBefore = await marginlyPool.positions(shorter.address);
    const quoteDebtBefore = await marginlyPool.discountedQuoteDebt();
    const baseDebtBefore = await marginlyPool.discountedBaseDebt();
    const quoteCollBefore = await marginlyPool.discountedQuoteCollateral();
    const baseCollBefore = await marginlyPool.discountedBaseCollateral();

    const receiveBaseAmount = BigNumber.from(shortAmount).mul(5).div(4);
    const baseOverflow = receiveBaseAmount.sub(shortAmount);
    expect(baseOverflow).to.be.greaterThan(0);
    await marginlyPool
      .connect(liquidator)
      .execute(CallType.ReceivePosition, 0, receiveBaseAmount, price, false, shorter.address, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(liquidator.address);
    expect(positionAfter._type).to.be.eq(PositionType.Lend);

    const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
    const quoteDelevCoeff = await marginlyPool.quoteDelevCoeff();
    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
    const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();

    const quoteDebtAfter = await marginlyPool.discountedQuoteDebt();
    const quoteCollAfter = await marginlyPool.discountedQuoteCollateral();
    const baseDebtAfter = await marginlyPool.discountedBaseDebt();
    const baseCollAfter = await marginlyPool.discountedBaseCollateral();

    expect(quoteDebtBefore).to.be.eq(quoteDebtAfter);

    const realBaseDebtBefore = baseDebtCoeff.mul(baseDebtBefore).div(FP96.one);
    const realBaseDebtAfter = baseDebtCoeff.mul(baseDebtAfter).div(FP96.one);
    expect(realBaseDebtBefore.sub(realBaseDebtAfter)).to.be.closeTo(shortAmount, shortAmount.div(1000));
    
    const posRealBaseCollateralAfter = baseCollateralCoeff.mul(positionAfter.discountedBaseAmount).div(FP96.one);
    expect(posRealBaseCollateralAfter).to.be.closeTo(baseOverflow, baseOverflow.div(1000));

    const realBaseCollateralBefore = baseCollateralCoeff.mul(baseCollBefore).div(FP96.one);
    const realBaseCollateralAfter = baseCollateralCoeff.mul(baseCollAfter).div(FP96.one);
    expect(
      realBaseCollateralAfter.sub(realBaseCollateralBefore)
    ).to.be.closeTo(baseOverflow, baseOverflow.div(1000));

    const realQuoteCollBefore = quoteCollateralCoeff.mul(quoteCollBefore).div(FP96.one).sub(
      quoteDelevCoeff.mul(baseDebtBefore).div(FP96.one)
    );
    const realQuoteCollAfter = quoteCollateralCoeff.mul(quoteCollAfter).div(FP96.one).sub(
      quoteDelevCoeff.mul(baseDebtAfter).div(FP96.one)
    );
    expect(realQuoteCollBefore).to.be.closeTo(realQuoteCollAfter, realQuoteCollAfter.div(1000));

    const posRealQuoteCollBefore = quoteCollateralCoeff.mul(positionBefore.discountedQuoteAmount).div(FP96.one).sub(
      quoteDelevCoeff.mul(positionBefore.discountedBaseAmount).div(FP96.one)
    );
    const posRealQuoteCollAfter = quoteCollateralCoeff.mul(positionAfter.discountedQuoteAmount).div(FP96.one);
    expect(posRealQuoteCollBefore).to.be.closeTo(posRealQuoteCollAfter, posRealQuoteCollAfter.div(1000));
  });

  it('receive long position after deleverage, debt fully covered', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(getDeleveragedPool);

    const [_, lender, longer, liquidator] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    const params = (await marginlyPool.params());
    let newParams = {...params};
    newParams.interestRate = 0;
    newParams.fee = 0;
    newParams.swapFee = 0;
    await marginlyPool.connect(factoryOwner).setParameters(newParams);

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const depositBaseAmount = 1000;
    // (baseDeposit + longAmount) / baseDeposit = (maxLev - 1)
    // shortAmount = (maxLev - 2) * quoteDeposit
    const longAmount = BigNumber.from(params.maxLeverage - 2).mul(depositBaseAmount);
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, depositBaseAmount, longAmount, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    newParams.maxLeverage /= 2;
    await marginlyPool.connect(factoryOwner).setParameters(newParams);

    const positionBefore = await marginlyPool.positions(longer.address);
    const quoteDebtBefore = await marginlyPool.discountedQuoteDebt();
    const baseDebtBefore = await marginlyPool.discountedBaseDebt();
    const baseCollBefore = await marginlyPool.discountedBaseCollateral();
    const quoteCollBefore = await marginlyPool.discountedQuoteCollateral();

    const receiveQuoteAmount = price.mul(longAmount).mul(5).div(4).div(FP96.one);
    const longAmountInQuote = price.mul(longAmount).div(FP96.one);
    const quoteOverflow = receiveQuoteAmount.sub(longAmountInQuote);
    expect(quoteOverflow).to.be.greaterThan(0);
    await marginlyPool
      .connect(liquidator)
      .execute(CallType.ReceivePosition, receiveQuoteAmount, 0, price, false, longer.address, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(liquidator.address);
    expect(positionAfter._type).to.be.eq(PositionType.Lend);

    const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();
    const baseDelevCoeff = await marginlyPool.baseDelevCoeff();
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
    const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();

    const baseCollAfter = await marginlyPool.discountedBaseCollateral();
    const baseDebtAfter = await marginlyPool.discountedBaseDebt();
    const quoteDebtAfter = await marginlyPool.discountedQuoteDebt();
    const quoteCollAfter = await marginlyPool.discountedQuoteCollateral();

    expect(baseDebtBefore).to.be.eq(baseDebtAfter);

    const realQuoteDebtBefore = quoteDebtCoeff.mul(quoteDebtBefore).div(FP96.one);
    const realQuoteDebtAfter = quoteDebtCoeff.mul(quoteDebtAfter).div(FP96.one);
    expect(
      realQuoteDebtBefore.sub(realQuoteDebtAfter)
    ).to.be.closeTo(longAmountInQuote, longAmountInQuote.div(1000));

    const posRealQuoteCollateralAfter = quoteCollateralCoeff.mul(positionAfter.discountedQuoteAmount).div(FP96.one);
    expect(posRealQuoteCollateralAfter).to.be.closeTo(quoteOverflow, quoteOverflow.div(1000));

    const realQuoteCollateralBefore = quoteCollateralCoeff.mul(quoteCollBefore).div(FP96.one);
    const realQuoteCollateralAfter = quoteCollateralCoeff.mul(quoteCollAfter).div(FP96.one);
    expect(
      realQuoteCollateralAfter.sub(realQuoteCollateralBefore)
    ).to.be.closeTo(quoteOverflow, quoteOverflow.div(1000));

    const realBaseCollBefore = baseCollateralCoeff.mul(baseCollBefore).div(FP96.one).sub(
      baseDelevCoeff.mul(quoteDebtBefore).div(FP96.one)
    );
    const realBaseCollAfter = baseCollateralCoeff.mul(baseCollAfter).div(FP96.one).sub(
      baseDelevCoeff.mul(quoteDebtAfter).div(FP96.one)
    );
    expect(realBaseCollBefore).to.be.closeTo(realBaseCollAfter, realBaseCollAfter.div(1000));

    const posRealBaseCollBefore = baseCollateralCoeff.mul(positionBefore.discountedBaseAmount).div(FP96.one).sub(
      baseDelevCoeff.mul(positionBefore.discountedQuoteAmount).div(FP96.one)
    );
    const posRealBaseCollAfter = baseCollateralCoeff.mul(positionAfter.discountedBaseAmount).div(FP96.one);
    expect(posRealBaseCollBefore).to.be.closeTo(posRealBaseCollAfter, posRealBaseCollAfter.div(1000));
  });

  it('receive short position after deleverage, increasing collateral', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(getDeleveragedPool);

    const [_, lender, shorter, liquidator] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    const params = (await marginlyPool.params());
    let newParams = {...params};
    newParams.interestRate = 0;
    newParams.fee = 0;
    newParams.swapFee = 0;
    await marginlyPool.connect(factoryOwner).setParameters(newParams);

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const depositQuoteAmount = 1000;
    // (quoteDeposit + price * shortAmount) / quoteDeposit = (maxLev - 1)
    // shortAmount = (maxLev - 2) * quoteDeposit / price
    const shortAmount = BigNumber.from(params.maxLeverage - 2).mul(depositQuoteAmount).mul(FP96.one).div(price);
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, depositQuoteAmount, shortAmount, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    newParams.maxLeverage /= 2;
    await marginlyPool.connect(factoryOwner).setParameters(newParams);

    const positionBefore = await marginlyPool.positions(shorter.address);
    const baseDebtBefore = await marginlyPool.discountedBaseDebt();
    const quoteCollBefore = await marginlyPool.discountedQuoteCollateral();
    const baseCollBefore = await marginlyPool.discountedBaseCollateral();

    const receiveQuoteAmount = price.mul(shortAmount).div(FP96.one);
    await marginlyPool
      .connect(liquidator)
      .execute(CallType.ReceivePosition, receiveQuoteAmount, 0, price, false, shorter.address, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(liquidator.address);
    expect(positionAfter._type).to.be.eq(PositionType.Short);

    const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
    const quoteDelevCoeff = await marginlyPool.quoteDelevCoeff();

    const quoteCollAfter = await marginlyPool.discountedQuoteCollateral();
    const baseDebtAfter = await marginlyPool.discountedBaseDebt();
    const baseCollAfter = await marginlyPool.discountedBaseCollateral();

    expect(baseCollBefore).to.be.eq(baseCollAfter);
    expect(baseDebtBefore).to.be.eq(baseDebtAfter);
    expect(positionBefore.discountedBaseAmount).to.be.eq(positionBefore.discountedBaseAmount);

    const realQuoteCollBefore = quoteCollateralCoeff.mul(quoteCollBefore).div(FP96.one).sub(
      quoteDelevCoeff.mul(baseDebtBefore).div(FP96.one)
    );
    const realQuoteCollAfter = quoteCollateralCoeff.mul(quoteCollAfter).div(FP96.one).sub(
      quoteDelevCoeff.mul(baseDebtAfter).div(FP96.one)
    );
    expect(
      realQuoteCollAfter.sub(realQuoteCollBefore)
    ).to.be.closeTo(receiveQuoteAmount, receiveQuoteAmount.div(1000));

    const posRealQuoteCollBefore = quoteCollateralCoeff.mul(positionBefore.discountedQuoteAmount).div(FP96.one).sub(
      quoteDelevCoeff.mul(positionBefore.discountedBaseAmount).div(FP96.one)
    );
    const posRealQuoteCollAfter = quoteCollateralCoeff.mul(positionAfter.discountedQuoteAmount).div(FP96.one).sub(
      quoteDelevCoeff.mul(positionBefore.discountedBaseAmount).div(FP96.one)
    );;
    expect(
      posRealQuoteCollAfter.sub(posRealQuoteCollBefore)
    ).to.be.closeTo(receiveQuoteAmount, receiveQuoteAmount.div(1000));
  });

  it('receive long position after deleverage, increasing collateral', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(getDeleveragedPool);

    const [_, lender, longer, liquidator] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    const params = (await marginlyPool.params());
    let newParams = {...params};
    newParams.interestRate = 0;
    newParams.fee = 0;
    newParams.swapFee = 0;
    await marginlyPool.connect(factoryOwner).setParameters(newParams);

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 100000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const depositBaseAmount = 1000;
    // (baseDeposit + longAmount) / baseDeposit = (maxLev - 1)
    // shortAmount = (maxLev - 2) * quoteDeposit
    const longAmount = BigNumber.from(params.maxLeverage - 2).mul(depositBaseAmount);
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, depositBaseAmount, longAmount, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    newParams.maxLeverage /= 2;
    await marginlyPool.connect(factoryOwner).setParameters(newParams);

    const positionBefore = await marginlyPool.positions(longer.address);
    const quoteDebtBefore = await marginlyPool.discountedQuoteDebt();
    const baseCollBefore = await marginlyPool.discountedBaseCollateral();
    const quoteCollBefore = await marginlyPool.discountedQuoteCollateral();

    const receiveBaseAmount = longAmount;
    await marginlyPool
      .connect(liquidator)
      .execute(CallType.ReceivePosition, 0, receiveBaseAmount, price, false, longer.address, uniswapV3Swapdata());

    const positionAfter = await marginlyPool.positions(liquidator.address);
    expect(positionAfter._type).to.be.eq(PositionType.Long);

    const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();
    const baseDelevCoeff = await marginlyPool.baseDelevCoeff();

    const baseCollAfter = await marginlyPool.discountedBaseCollateral();
    const quoteDebtAfter = await marginlyPool.discountedQuoteDebt();
    const quoteCollAfter = await marginlyPool.discountedQuoteCollateral();

    expect(quoteCollAfter).to.be.eq(quoteCollBefore);
    expect(quoteDebtAfter).to.be.eq(quoteDebtBefore);
    expect(positionAfter.discountedQuoteAmount).to.be.eq(positionBefore.discountedQuoteAmount)

    const realBaseCollBefore = baseCollateralCoeff.mul(baseCollBefore).div(FP96.one).sub(
      baseDelevCoeff.mul(quoteDebtBefore).div(FP96.one)
    );
    const realBaseCollAfter = baseCollateralCoeff.mul(baseCollAfter).div(FP96.one).sub(
      baseDelevCoeff.mul(quoteDebtAfter).div(FP96.one)
    );
    expect(realBaseCollAfter.sub(realBaseCollBefore)).to.be.closeTo(receiveBaseAmount, receiveBaseAmount.div(1000));

    const posRealBaseCollBefore = baseCollateralCoeff.mul(positionBefore.discountedBaseAmount).div(FP96.one).sub(
      baseDelevCoeff.mul(positionBefore.discountedQuoteAmount).div(FP96.one)
    );
    const posRealBaseCollAfter = baseCollateralCoeff.mul(positionAfter.discountedBaseAmount).div(FP96.one).sub(
      baseDelevCoeff.mul(positionAfter.discountedQuoteAmount).div(FP96.one)
    );
    expect(
      posRealBaseCollAfter.sub(posRealBaseCollBefore)
    ).to.be.closeTo(receiveBaseAmount, receiveBaseAmount.div(1000));
  });
});
