import { createMarginlyPool } from './shared/fixtures';
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

    const posDisColl = (await marginlyPool.positions(longer.address)).discountedBaseAmount;
    const discountedBaseCollateral = await marginlyPool.discountedBaseCollateral();
    const discountedBaseDebt = await marginlyPool.discountedBaseDebt();

    await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    const longerPosition = await marginlyPool.positions(longer.address);

    expect(longerPosition._type).to.be.equal(0);
    expect(longerPosition.discountedBaseAmount).to.be.equal(0);
    expect(longerPosition.discountedQuoteAmount).to.be.equal(0);

    const quoteCollateralDelevCoeff = await marginlyPool.quoteCollateralDelevCoeff();
    const baseDebtDelevCoeff = await marginlyPool.baseDebtDelevCoeff();
    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();
    const price = (await marginlyPool.getBasePrice()).inner;

    const poolBaseCollateral = baseCollCoeff.mul(discountedBaseCollateral).div(FP96.one);
    const poolBaseDebt = baseDebtCoeff.mul(discountedBaseDebt).div(FP96.one);
    const positionBaseCollateral = baseCollCoeff.mul(posDisColl).div(FP96.one);

    const n = Math.ceil(Math.log2(poolBaseDebt.toNumber() / (poolBaseCollateral.sub(positionBaseCollateral)).toNumber()));
    const delevRatioDebt = BigNumber.from(FP96.one).sub(BigNumber.from(FP96.one).div(2 ** n));

    expect(baseDebtDelevCoeff).to.be.equal(delevRatioDebt);
    expect(quoteCollateralDelevCoeff).to.be.closeTo(
        delevRatioDebt.mul(price).div(FP96.one), quoteCollateralDelevCoeff.mul(1).div(1000)
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

    const posDisColl = (await marginlyPool.positions(shorter.address)).discountedQuoteAmount;
    const discountedQuoteCollateral = await marginlyPool.discountedQuoteCollateral();
    const discountedQuoteDebt = await marginlyPool.discountedQuoteDebt();

    await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    const shorterPosition = await marginlyPool.positions(shorter.address);

    expect(shorterPosition._type).to.be.equal(0);
    expect(shorterPosition.discountedBaseAmount).to.be.equal(0);
    expect(shorterPosition.discountedQuoteAmount).to.be.equal(0);

    const baseCollateralDelevCoeff = await marginlyPool.baseCollateralDelevCoeff();
    const quoteDebtDelevCoeff = await marginlyPool.quoteDebtDelevCoeff();
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();
    const price = (await marginlyPool.getBasePrice()).inner;

    const poolQuoteCollateral = quoteCollCoeff.mul(discountedQuoteCollateral).div(FP96.one);
    const poolQuoteDebt = quoteDebtCoeff.mul(discountedQuoteDebt).div(FP96.one);
    const positionQuoteCollateral = quoteCollCoeff.mul(posDisColl).div(FP96.one);

    const n = Math.ceil(Math.log2(poolQuoteDebt.toNumber() / (poolQuoteCollateral.sub(positionQuoteCollateral)).toNumber()));
    const delevRatioDebt = BigNumber.from(FP96.one).sub(BigNumber.from(FP96.one).div(2 ** n));

    expect(quoteDebtDelevCoeff).to.be.equal(delevRatioDebt);
    expect(baseCollateralDelevCoeff).to.be.closeTo(
        delevRatioDebt.mul(FP96.one).div(price), baseCollateralDelevCoeff.mul(1).div(1000)
    );
    
  });

  it('reinit shorter after long deleverage', async () => {
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
    const posDisColl = (await marginlyPool.positions(longer.address)).discountedBaseAmount;
    const discountedBaseCollateral = await marginlyPool.discountedBaseCollateral();
    const discountedBaseDebt = await marginlyPool.discountedBaseDebt();

    await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    const positionBefore = await marginlyPool.positions(shorter.address);
    const quoteCollateralDelevCoeff = await marginlyPool.quoteCollateralDelevCoeff();
    const baseDebtDelevCoeff = await marginlyPool.baseDebtDelevCoeff();
    const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();
    const price = (await marginlyPool.getBasePrice()).inner;

    const poolBaseCollateral = baseCollCoeff.mul(discountedBaseCollateral).div(FP96.one);
    const poolBaseDebt = baseDebtCoeff.mul(discountedBaseDebt).div(FP96.one);
    const positionBaseCollateral = baseCollCoeff.mul(posDisColl).div(FP96.one);

    const n = Math.ceil(Math.log2(poolBaseDebt.toNumber() / (poolBaseCollateral.sub(positionBaseCollateral)).toNumber()));
    const delevRatioDebt = BigNumber.from(FP96.one).sub(BigNumber.from(FP96.one).div(2 ** n));

    await marginlyPool.connect(shorter).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    const positionAfter = await marginlyPool.positions(shorter.address);

    expect(positionAfter.collateralDelevCoeff.inner).to.be.equal(quoteCollateralDelevCoeff);
    expect(positionAfter.debtDelevCoeff.inner).to.be.equal(baseDebtDelevCoeff);

    const posBaseAmount = positionBefore.discountedBaseAmount.mul(delevRatioDebt).div(FP96.one);
    const posQuoteAmount = positionBefore.discountedQuoteAmount.mul(delevRatioDebt).div(FP96.one).mul(price).div(FP96.one);

    expect(positionAfter.discountedBaseAmount).to.be.closeTo(posBaseAmount, posBaseAmount.div(1000));
    expect(positionAfter.discountedQuoteAmount).to.be.closeTo(posQuoteAmount, posQuoteAmount.div(1000));
  });

  it('reinit longer after short deleverage', async () => {
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

    const posDisColl = (await marginlyPool.positions(shorter.address)).discountedQuoteAmount;
    const discountedQuoteCollateral = await marginlyPool.discountedQuoteCollateral();
    const discountedQuoteDebt = await marginlyPool.discountedQuoteDebt();

    await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    const baseCollateralDelevCoeff = await marginlyPool.baseCollateralDelevCoeff();
    const quoteDebtDelevCoeff = await marginlyPool.quoteDebtDelevCoeff();
    const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();
    const price = (await marginlyPool.getBasePrice()).inner;

    const positionBefore = await marginlyPool.positions(longer.address);
    const poolQuoteCollateral = quoteCollCoeff.mul(discountedQuoteCollateral).div(FP96.one);
    const poolQuoteDebt = quoteDebtCoeff.mul(discountedQuoteDebt).div(FP96.one);
    const positionQuoteCollateral = quoteCollCoeff.mul(posDisColl).div(FP96.one);

    const n = Math.ceil(Math.log2(poolQuoteDebt.toNumber() / (poolQuoteCollateral.sub(positionQuoteCollateral)).toNumber()));
    const delevRatioDebt = BigNumber.from(FP96.one).sub(BigNumber.from(FP96.one).div(2 ** n));

    await marginlyPool.connect(longer).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    const positionAfter = await marginlyPool.positions(longer.address);

    expect(positionAfter.collateralDelevCoeff.inner).to.be.equal(baseCollateralDelevCoeff);
    expect(positionAfter.debtDelevCoeff.inner).to.be.equal(quoteDebtDelevCoeff);

    const posQuoteAmount = positionBefore.discountedQuoteAmount.mul(delevRatioDebt).div(FP96.one);
    const posBaseAmount = positionBefore.discountedBaseAmount.mul(delevRatioDebt).div(FP96.one).mul(FP96.one).div(price);

    expect(positionAfter.discountedQuoteAmount).to.be.closeTo(posQuoteAmount, posQuoteAmount.div(1000));
    expect(positionAfter.discountedBaseAmount).to.be.closeTo(posBaseAmount, posBaseAmount.div(1000));
  });

  it('new long position', async () => {
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
    await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    const baseCollateralDelevCoeff = await marginlyPool.baseCollateralDelevCoeff();
    const quoteDebtDelevCoeff = await marginlyPool.quoteDebtDelevCoeff();

    const newLonger = accounts[3];
    await marginlyPool.connect(newLonger).execute(CallType.DepositBase, 1000, 2000, false, ZERO_ADDRESS);

    const position = await marginlyPool.positions(newLonger.address);
    expect(position.collateralDelevCoeff.inner).to.be.equal(baseCollateralDelevCoeff);
    expect(position.debtDelevCoeff.inner).to.be.equal(quoteDebtDelevCoeff);
  });

  it('new short position', async () => {
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

    await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS);

    const quoteCollateralDelevCoeff = await marginlyPool.quoteCollateralDelevCoeff();
    const baseDebtDelevCoeff = await marginlyPool.baseDebtDelevCoeff();

    const newShorter = accounts[3];
    await marginlyPool.connect(newShorter).execute(CallType.DepositQuote, 1000, 2000, false, ZERO_ADDRESS);

    const position = await marginlyPool.positions(newShorter.address);
    expect(position.collateralDelevCoeff.inner).to.be.equal(quoteCollateralDelevCoeff);
    expect(position.debtDelevCoeff.inner).to.be.equal(baseDebtDelevCoeff);
  });
});