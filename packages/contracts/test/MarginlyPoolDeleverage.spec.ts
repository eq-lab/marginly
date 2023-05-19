import { createMarginlyPool, getDeleveragedPool } from './shared/fixtures';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { CallType, FP96, powTaylor, YEAR, ZERO_ADDRESS } from './shared/utils';
import { BigNumber } from 'ethers';

describe('Deleverage', () => {
  it('Deleverage short', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);

    const accounts = await ethers.getSigners();

    const lender = accounts[0];
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 10000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 10000, 0, false, ZERO_ADDRESS); 

    const longer = accounts[1];
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 18000, false, ZERO_ADDRESS);

    const shorter = accounts[2];
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 100000, 20000, false, ZERO_ADDRESS);

    await time.increase(10 * 24 * 60 * 60);

    const baseDebtCoeffBefore = await marginlyPool.baseDebtCoeff();
    const shortLev = (await marginlyPool.systemLeverage()).shortX96;
    const posDisDebt = (await marginlyPool.positions(longer.address)).discountedQuoteAmount;
    const posDisColl = (await marginlyPool.positions(longer.address)).discountedBaseAmount;
    const lastReinitTimestampBefore = await marginlyPool.lastReinitTimestampSeconds();

    await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    const lastReinitTimestamp = await marginlyPool.lastReinitTimestampSeconds();
    const timeShift = +lastReinitTimestamp.sub(lastReinitTimestampBefore);

    const ir = BigNumber.from((await marginlyPool.params()).interestRate)
      .mul(FP96.one)
      .div(1e6);
    const ar = powTaylor(shortLev.mul(ir).div(YEAR).add(FP96.one), timeShift);
    const baseDebtCoeffReinit = baseDebtCoeffBefore.mul(ar).div(FP96.one);
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
    const posRealDebt = posDisDebt.mul(quoteDebtCoeff).div(FP96.one);

    const longerPosition = await marginlyPool.positions(longer.address);

    expect(longerPosition._type).to.be.equal(0);
    expect(longerPosition.discountedBaseAmount).to.be.equal(0);
    expect(longerPosition.discountedQuoteAmount).to.be.equal(0);

    const quoteDelevCoeff = await marginlyPool.quoteDelevCoeff();
    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();
    const discountedBaseDebt = await marginlyPool.discountedBaseDebt();

    const posRealColl = baseCollCoeff.mul(posDisColl).div(FP96.one);

    expect(quoteDelevCoeff).to.be.equal(posRealDebt.mul(FP96.one).div(discountedBaseDebt));
    expect(baseDebtCoeff).to.be.equal(
      baseDebtCoeffReinit.sub(posRealColl.mul(FP96.one).div(discountedBaseDebt))
    );
  });

  it('Deleverage long', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);

    const accounts = await ethers.getSigners();

    const lender = accounts[0];
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 10000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS); 

    const shorter = accounts[1];
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 100, 7200, false, ZERO_ADDRESS);

    const longer = accounts[2];
    await marginlyPool.connect(longer).execute(CallType.DepositBase, 10000, 8000, false, ZERO_ADDRESS);

    await time.increase(10 * 24 * 60 * 60);

    const quoteDebtCoeffBefore = await marginlyPool.quoteDebtCoeff();
    const longLev = (await marginlyPool.systemLeverage()).longX96;
    const posDisDebt = (await marginlyPool.positions(shorter.address)).discountedBaseAmount;
    const posDisColl = (await marginlyPool.positions(shorter.address)).discountedQuoteAmount;
    const lastReinitTimestampBefore = await marginlyPool.lastReinitTimestampSeconds();

    await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    const lastReinitTimestamp = await marginlyPool.lastReinitTimestampSeconds();
    const timeShift = +lastReinitTimestamp.sub(lastReinitTimestampBefore);

    const ir = BigNumber.from((await marginlyPool.params()).interestRate)
      .mul(FP96.one)
      .div(1e6);
    const ar = powTaylor(longLev.mul(ir).div(YEAR).add(FP96.one), timeShift);
    const quoteDebtCoeffReinit = quoteDebtCoeffBefore.mul(ar).div(FP96.one);
    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
    const posRealDebt = posDisDebt.mul(baseDebtCoeff).div(FP96.one);

    const shorterPosition = await marginlyPool.positions(shorter.address);

    expect(shorterPosition._type).to.be.equal(0);
    expect(shorterPosition.discountedBaseAmount).to.be.equal(0);
    expect(shorterPosition.discountedQuoteAmount).to.be.equal(0);

    const baseDelevCoeff = await marginlyPool.baseDelevCoeff();
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();
    const discountedQuoteDebt = await marginlyPool.discountedQuoteDebt();

    const posRealColl = quoteCollCoeff.mul(posDisColl).div(FP96.one);

    expect(baseDelevCoeff).to.be.equal(posRealDebt.mul(FP96.one).div(discountedQuoteDebt));
    expect(quoteDebtCoeff).to.be.equal(
      quoteDebtCoeffReinit.sub(posRealColl.mul(FP96.one).div(discountedQuoteDebt))
    );
  });

  it('short call after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, shorter] = await ethers.getSigners();

    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);

    const positionBefore = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralBefore = await marginlyPool.discountedQuoteCollateral(); 

    const shortAmount = 1000;
    await marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS);

    const price = (await marginlyPool.getBasePrice()).inner;
    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();
    const quoteDelevCoeff = await marginlyPool.quoteDelevCoeff();
    const positionAfter = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralAfter = await marginlyPool.discountedQuoteCollateral();

    const quoteCollDelta = price.mul(shortAmount).div(quoteCollCoeff).add(
      quoteDelevCoeff.mul(shortAmount).mul(FP96.one).div(baseDebtCoeff).div(quoteCollCoeff)
    );

    const posQuoteCollDelta = positionAfter.discountedQuoteAmount.sub(positionBefore.discountedQuoteAmount);
    expect(posQuoteCollDelta).to.be.equal(quoteCollDelta);

    const totalQuoteCollDelta = disQuoteCollateralAfter.sub(disQuoteCollateralBefore);
    expect(totalQuoteCollDelta).to.be.equal(quoteCollDelta);
  });

  it('long call after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, longer] = await ethers.getSigners();

    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    const positionBefore = await marginlyPool.positions(longer.address);
    const disBaseCollateralBefore = await marginlyPool.discountedBaseCollateral(); 

    const longAmount = 1000;
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);

    const price = (await marginlyPool.getBasePrice()).inner;
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();
    const baseDelevCoeff = await marginlyPool.baseDelevCoeff();
    const positionAfter = await marginlyPool.positions(longer.address);
    const disBaseCollateralAfter = await marginlyPool.discountedBaseCollateral();

    const baseCollDelta = BigNumber.from(longAmount).mul(FP96.one).div(baseCollCoeff).add(
      baseDelevCoeff.mul(price).mul(longAmount).div(quoteDebtCoeff).div(baseCollCoeff)
    );

    const posBaseCollDelta = positionAfter.discountedBaseAmount.sub(positionBefore.discountedBaseAmount);
    expect(posBaseCollDelta).to.be.closeTo(baseCollDelta, 1);

    const totalBaseCollDelta = disBaseCollateralAfter.sub(disBaseCollateralBefore);
    expect(totalBaseCollDelta).to.be.closeTo(baseCollDelta, 1);
  });

  it('depositQuote call after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, shorter] = await ethers.getSigners();

    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);

    const shortAmount = 1000;
    await marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS);

    const positionBefore = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralBefore = await marginlyPool.discountedQuoteCollateral(); 

    const quoteDepositAmount = 500;
    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, quoteDepositAmount, 0, false, ZERO_ADDRESS);

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

    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    const longAmount = 1000;
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);

    const positionBefore = await marginlyPool.positions(longer.address);
    const disBaseCollateralBefore = await marginlyPool.discountedBaseCollateral(); 

    const baseDepositAmount = 500;
    await marginlyPool.connect(longer).execute(CallType.DepositBase, baseDepositAmount, 0, false, ZERO_ADDRESS);

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

    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);

    const shortAmount = 1000;
    await marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS);

    const positionBefore = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralBefore = await marginlyPool.discountedQuoteCollateral(); 

    const quoteAmountWithdrawn = 500;
    await marginlyPool.connect(shorter).execute(CallType.WithdrawQuote, quoteAmountWithdrawn, 0, false, ZERO_ADDRESS);

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

    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    const longAmount = 1000;
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);

    const positionBefore = await marginlyPool.positions(longer.address);
    const disBaseCollateralBefore = await marginlyPool.discountedBaseCollateral(); 

    const baseAmountWithdrawn = 500;
    await marginlyPool.connect(longer).execute(CallType.WithdrawBase, baseAmountWithdrawn, 0, false, ZERO_ADDRESS);

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

    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(longer).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    const longAmount = 1000;
    await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS);

    const positionBefore = await marginlyPool.positions(longer.address);
    const disBaseCollateralBefore = await marginlyPool.discountedBaseCollateral();
    const disQuoteDebtBefore = await marginlyPool.discountedQuoteDebt();

    await time.increase(10 * 24 * 60 * 60);
    await marginlyPool.connect(longer).execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS);

    const positionAfter = await marginlyPool.positions(longer.address);

    expect(positionAfter.discountedQuoteAmount).to.be.equal(0);
    const disQuoteDebtAfter = await marginlyPool.discountedQuoteDebt();
    const totalQuoteDebtDelta = disQuoteDebtBefore.sub(disQuoteDebtAfter);
    expect(totalQuoteDebtDelta).to.be.equal(positionBefore.discountedQuoteAmount);

    const price = (await marginlyPool.getBasePrice()).inner;
    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();
    const baseDelevCoeff = await marginlyPool.baseDelevCoeff();
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();

    // posBefore.discountedQuoteAmount * quoteDebtCoeff / price
    // .div(FP96.one).mul(FP96.one) is here to reproduce onchain calculation of FP96 math operations with max precision
    const realCollDelta = positionBefore.discountedQuoteAmount.mul(quoteDebtCoeff).div(FP96.one).mul(FP96.one).div(price);
    // (realCollDelta + pos.discountedQuoteAmount * baseDelevCoeff) / baseCollCoeff
    const disBaseCollDelta = realCollDelta.add(
      positionBefore.discountedQuoteAmount.mul(baseDelevCoeff).div(FP96.one)
    ).mul(FP96.one).div(baseCollCoeff);

    const disBaseCollateralAfter = await marginlyPool.discountedBaseCollateral(); 
    
    const posBaseCollDelta = positionBefore.discountedBaseAmount.sub(positionAfter.discountedBaseAmount);
    expect(posBaseCollDelta).to.be.closeTo(disBaseCollDelta, 1);
    
    const totalBaseCollDelta = disBaseCollateralBefore.sub(disBaseCollateralAfter);
    expect(totalBaseCollDelta).to.be.closeTo(disBaseCollDelta, 1);
  });

  it('close short position after deleverage', async () => {
    const { marginlyPool } = await loadFixture(getDeleveragedPool);

    const [_, lender, shorter] = await ethers.getSigners();

    await marginlyPool.connect(lender).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(lender).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);

    await marginlyPool.connect(shorter).execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS);

    const shortAmount = 1000;
    await marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS);

    const positionBefore = await marginlyPool.positions(shorter.address);
    const disQuoteCollateralBefore = await marginlyPool.discountedQuoteCollateral();
    const disBaseDebtBefore = await marginlyPool.discountedBaseDebt();

    await time.increase(10 * 24 * 60 * 60);
    await marginlyPool.connect(shorter).execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS);

    const positionAfter = await marginlyPool.positions(shorter.address);

    expect(positionAfter.discountedBaseAmount).to.be.equal(0);
    const disBaseDebtAfter = await marginlyPool.discountedBaseDebt();
    const totalBaseDebtDelta = disBaseDebtBefore.sub(disBaseDebtAfter);
    expect(totalBaseDebtDelta).to.be.equal(positionBefore.discountedBaseAmount);

    const price = (await marginlyPool.getBasePrice()).inner;
    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();
    const quoteDelevCoeff = await marginlyPool.quoteDelevCoeff();
    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();

    const realCollDelta = positionBefore.discountedBaseAmount.mul(baseDebtCoeff).div(FP96.one).mul(price).div(FP96.one);
    // (realCollDelta + pos.discountedBaseAmount * quoteDelevCoeff) / quoteCollCoeff
    const disQuoteCollDelta = realCollDelta.add(
      positionBefore.discountedBaseAmount.mul(quoteDelevCoeff).div(FP96.one)
    ).mul(FP96.one).div(quoteCollCoeff);

    const disQuoteCollateralAfter = await marginlyPool.discountedQuoteCollateral(); 
    
    const posQuoteCollDelta = positionBefore.discountedQuoteAmount.sub(positionAfter.discountedQuoteAmount);
    expect(posQuoteCollDelta).to.be.equal(disQuoteCollDelta);
    
    const totalQuoteCollDelta = disQuoteCollateralBefore.sub(disQuoteCollateralAfter);
    expect(totalQuoteCollDelta).to.be.equal(disQuoteCollDelta);
  });
});