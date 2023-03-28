import { createMarginlyPool } from './shared/fixtures';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { FP96, MarginlyPoolMode } from './shared/utils';

describe('MarginlyPool.Shutdown', () => {
  it('should revert when collateral enough', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, depositer] = await ethers.getSigners();

    const amountToDeposit = 100;
    await marginlyPool.connect(depositer).depositBase(amountToDeposit);

    await expect(marginlyPool.connect(owner).shutDown()).to.be.rejectedWith('NE');
  });

  it('should switch system in ShortEmergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createMarginlyPool);
    const [owner, depositer, shorter] = await ethers.getSigners();

    await pool.setParityPrice();

    const amountToDeposit = 100;
    await marginlyPool.connect(depositer).depositBase(amountToDeposit);

    await marginlyPool.connect(shorter).depositQuote(amountToDeposit);
    const shortAmount = 100;
    await marginlyPool.connect(shorter).short(shortAmount);

    //Quote price lower than Base price
    await pool.setPriceQuoteLowerThanBase();

    //wait for accrue interest
    const timeShift = 24 * 60 * 60;
    await time.increase(timeShift);

    await expect(marginlyPool.reinit()).to.be.rejected;

    await marginlyPool.connect(owner).shutDown();
    expect(await marginlyPool.mode()).to.be.equals(MarginlyPoolMode.ShortEmergency);
    expect(await marginlyPool.emergencyWithdrawCoeff()).not.to.be.equal(0);

    // can't switch second time to emergency mode
    await expect(marginlyPool.shutDown()).to.be.rejectedWith('EM');
  });

  it('should switch system in LongEmergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createMarginlyPool);
    const [owner, depositer, longer] = await ethers.getSigners();

    await pool.setParityPrice();

    const amountToDeposit = 100;
    await marginlyPool.connect(depositer).depositQuote(amountToDeposit);

    await marginlyPool.connect(longer).depositBase(amountToDeposit);
    const longAmount = 100;
    await marginlyPool.connect(longer).long(longAmount);

    //Base price lower than Quote price
    await pool.setPriceQuoteBiggerThanBase();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    await marginlyPool.connect(owner).shutDown();
    expect(await marginlyPool.mode()).to.be.equals(MarginlyPoolMode.LongEmergency);
    expect(await marginlyPool.emergencyWithdrawCoeff()).not.to.be.equal(0);

    // can't switch second time to emergency mode
    await expect(marginlyPool.shutDown()).to.be.rejectedWith('EM');
  });

  it('withdraw tokens for Long/Lend position in ShortEmergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
      baseContract,
      quoteContract,
    } = await loadFixture(createMarginlyPool);
    const [owner, depositer, shorter, longer] = await ethers.getSigners();

    await pool.setParityPrice();

    const amountToDeposit = 100;
    await marginlyPool.connect(depositer).depositBase(amountToDeposit);

    await marginlyPool.connect(shorter).depositQuote(amountToDeposit);
    const shortAmount = 100;
    await marginlyPool.connect(shorter).short(shortAmount);

    await marginlyPool.connect(longer).depositBase(amountToDeposit);
    const longAmount = 50;
    await marginlyPool.connect(longer).long(longAmount);

    //Quote price lower than Base price
    await pool.setPriceQuoteLowerThanBase();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    await marginlyPool.connect(owner).shutDown();
    expect(await marginlyPool.mode()).to.be.equal(MarginlyPoolMode.ShortEmergency);

    const emergencyWithdrawCoeff = await marginlyPool.emergencyWithdrawCoeff();

    const longerBalanceBefore = await baseContract.balanceOf(longer.address);
    const depositerBalanceBefore = await baseContract.balanceOf(depositer.address);

    const depositerPosition = await marginlyPool.positions(depositer.address);

    const longerPosition = await marginlyPool.positions(longer.address);

    await marginlyPool.connect(depositer).emergencyWithdraw();
    await marginlyPool.connect(longer).emergencyWithdraw();

    const longerBalanceAfter = await baseContract.balanceOf(longer.address);
    const depositerBalanceAfter = await baseContract.balanceOf(depositer.address);
    const actualLongerBaseAmount = longerBalanceAfter.sub(longerBalanceBefore);
    const actualDepositerBaseAmount = depositerBalanceAfter.sub(depositerBalanceBefore);

    const expectedLongerBaseAmount = emergencyWithdrawCoeff.mul(longerPosition.discountedBaseAmount).div(FP96.one);
    const expectedDepositerBaseAmount = emergencyWithdrawCoeff
      .mul(depositerPosition.discountedBaseAmount)
      .div(FP96.one);

    expect(actualLongerBaseAmount).to.be.equal(expectedLongerBaseAmount);
    expect(actualDepositerBaseAmount).to.be.equal(expectedDepositerBaseAmount);

    const longerPositionafter = await marginlyPool.positions(longer.address);
    expect(longerPositionafter._type).to.be.equal(0);
    expect(longerPositionafter.discountedBaseAmount).to.be.equal(0);
    expect(longerPositionafter.discountedQuoteAmount).to.be.equal(0);

    const depositerPositionAfter = await marginlyPool.positions(depositer.address);
    expect(depositerPositionAfter._type).to.be.equal(0);
    expect(depositerPositionAfter.discountedBaseAmount).to.be.equal(0);
    expect(depositerPositionAfter.discountedQuoteAmount).to.be.equal(0);

    const poolBaseBalance = await baseContract.balanceOf(marginlyPool.address);
    expect(poolBaseBalance).to.be.lessThanOrEqual(2);
    const poolQuoteBalance = await quoteContract.balanceOf(marginlyPool.address);
    expect(poolQuoteBalance).to.be.lessThanOrEqual(2);

    console.log(`pool state after withdraw: base=${poolBaseBalance} quote=${poolQuoteBalance}`);
  });

  it('withdraw tokens for Short/Lend position in LongEmergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
      quoteContract,
      baseContract,
    } = await loadFixture(createMarginlyPool);
    const [owner, depositer, longer, shorter] = await ethers.getSigners();

    await pool.setParityPrice();

    const amountToDeposit = 100;
    await marginlyPool.connect(depositer).depositQuote(amountToDeposit);
    await marginlyPool.connect(depositer).depositBase(10);

    await marginlyPool.connect(longer).depositBase(amountToDeposit);

    const longAmount = 100;
    await marginlyPool.connect(longer).long(longAmount);

    await marginlyPool.connect(shorter).depositQuote(amountToDeposit);
    const shortAmount = 50;
    await marginlyPool.connect(shorter).short(shortAmount);

    //Base price lower than Quote price
    await pool.setPriceQuoteBiggerThanBase();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    await marginlyPool.connect(owner).shutDown();
    expect(await marginlyPool.mode()).to.be.equal(MarginlyPoolMode.LongEmergency);

    const emergencyWithdrawCoeff = await marginlyPool.emergencyWithdrawCoeff();

    const shorterBalanceBefore = await quoteContract.balanceOf(shorter.address);
    const depositerBalanceBefore = await quoteContract.balanceOf(depositer.address);

    const depositerPosition = await marginlyPool.positions(depositer.address);

    const shorterPosition = await marginlyPool.positions(shorter.address);

    await marginlyPool.connect(depositer).emergencyWithdraw();
    await marginlyPool.connect(shorter).emergencyWithdraw();

    const shorterBalanceAfter = await quoteContract.balanceOf(shorter.address);
    const depositerBalanceAfter = await quoteContract.balanceOf(depositer.address);
    const actualShorterQuoteAmount = shorterBalanceAfter.sub(shorterBalanceBefore);
    const actualDepositerQuoteAmount = depositerBalanceAfter.sub(depositerBalanceBefore);

    const expectedShorterQuoteAmount = emergencyWithdrawCoeff.mul(shorterPosition.discountedQuoteAmount).div(FP96.one);

    const expectedDepositerQuoteAmount = emergencyWithdrawCoeff
      .mul(depositerPosition.discountedQuoteAmount)
      .div(FP96.one);

    expect(actualShorterQuoteAmount).to.be.equal(expectedShorterQuoteAmount);
    expect(actualDepositerQuoteAmount).to.be.equal(expectedDepositerQuoteAmount);

    const shorterPositionAfter = await marginlyPool.positions(shorter.address);
    expect(shorterPositionAfter._type).to.be.equal(0);
    expect(shorterPositionAfter.discountedBaseAmount).to.be.equal(0);
    expect(shorterPositionAfter.discountedQuoteAmount).to.be.equal(0);

    const depositerPositionAfter = await marginlyPool.positions(depositer.address);
    expect(depositerPositionAfter._type).to.be.equal(0);
    expect(depositerPositionAfter.discountedBaseAmount).to.be.equal(0);
    expect(depositerPositionAfter.discountedQuoteAmount).to.be.equal(0);

    const poolBaseBalance = await baseContract.balanceOf(marginlyPool.address);
    expect(poolBaseBalance).to.be.lessThanOrEqual(2);
    const poolQuoteBalance = await quoteContract.balanceOf(marginlyPool.address);
    expect(poolQuoteBalance).to.be.lessThanOrEqual(2);

    console.log(`pool state after withdraw: base=${poolBaseBalance} quote=${poolQuoteBalance}`);
  });

  it('should revert withdraw tokens from Short position in ShortEmergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createMarginlyPool);
    const [owner, depositer, shorter] = await ethers.getSigners();

    await pool.setParityPrice();

    const amountToDeposit = 100;
    await marginlyPool.connect(depositer).depositBase(amountToDeposit);

    await marginlyPool.connect(shorter).depositQuote(amountToDeposit);
    const shortAmount = 100;
    await marginlyPool.connect(shorter).short(shortAmount);

    //Quote price lower than Base price
    await pool.setPriceQuoteLowerThanBase();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    await marginlyPool.connect(owner).shutDown();
    expect(await marginlyPool.mode()).to.be.equal(MarginlyPoolMode.ShortEmergency);

    await expect(marginlyPool.connect(shorter).emergencyWithdraw()).to.be.rejectedWith('SE');
  });

  it('should revert withdraw tokens from Long position in LongEmergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createMarginlyPool);
    const [owner, depositer, longer] = await ethers.getSigners();

    await pool.setParityPrice();

    const amountToDeposit = 100;
    await marginlyPool.connect(depositer).depositQuote(amountToDeposit);

    await marginlyPool.connect(longer).depositBase(amountToDeposit);
    const longAmount = 100;
    await marginlyPool.connect(longer).long(longAmount);

    //Base price lower than Quote price
    await pool.setPriceQuoteBiggerThanBase();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    await marginlyPool.connect(owner).shutDown();

    await expect(marginlyPool.connect(longer).emergencyWithdraw()).to.be.rejectedWith('LE');
  });
});
