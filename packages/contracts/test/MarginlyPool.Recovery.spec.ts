import { createMarginlyPool } from './shared/fixtures';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { calcLeverageLong, calcLeverageShort, MarginlyPoolMode, PositionType, toHumanString } from './shared/utils';

describe('MarginlyPool.Recovery', () => {
  it('set recovery mode available only for admin', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer] = await ethers.getSigners();

    await expect(marginlyPool.connect(signer).setRecoveryMode(true)).to.be.rejectedWith('AD');
  });

  it('set recovery mode', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner] = await ethers.getSigners();

    await marginlyPool.connect(owner).setRecoveryMode(true);
    expect(await marginlyPool.mode()).to.be.equal(MarginlyPoolMode.Recovery);

    await marginlyPool.connect(owner).setRecoveryMode(false);
    expect(await marginlyPool.mode()).to.be.equal(MarginlyPoolMode.Regular);
  });

  it('set recovery mode should revert when system in emergency mode', async () => {
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

    await expect(marginlyPool.connect(owner).setRecoveryMode(true)).to.be.revertedWithoutReason();
  });

  it('opening new position not allowed in recovery mode', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, shorter, depositer] = await ethers.getSigners();

    const amountToDeposit = 100;
    await marginlyPool.connect(depositer).depositBase(amountToDeposit);
    await marginlyPool.connect(shorter).depositQuote(amountToDeposit);

    await marginlyPool.connect(owner).setRecoveryMode(true);

    await expect(marginlyPool.connect(depositer).long(1)).to.be.rejectedWith('NA');

    await expect(marginlyPool.connect(shorter).short(1)).to.be.rejectedWith('NA');
  });

  it('reinit short position in Recovery mode', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, shorter, depositer] = await ethers.getSigners();

    const depositAmount = 20000;
    await marginlyPool.connect(depositer).depositBase(depositAmount);
    await marginlyPool.connect(depositer).depositQuote(depositAmount);

    const shorterCollateral = 100;
    await marginlyPool.connect(shorter).depositQuote(shorterCollateral);

    const shortAmount = 6500; // leverage 17.24
    await marginlyPool.connect(shorter).short(shortAmount);

    let shortPosition = await marginlyPool.positions(shorter.address);

    const leverage = calcLeverageShort(
      (await marginlyPool.getBasePrice()).inner,
      await marginlyPool.quoteCollateralCoeff(),
      await marginlyPool.baseDebtCoeff(),
      shortPosition.discountedQuoteAmount,
      shortPosition.discountedBaseAmount
    );
    console.log(toHumanString(leverage));

    await marginlyPool.connect(depositer).reinit();
    shortPosition = await marginlyPool.positions(shorter.address);
    expect(shortPosition._type).to.be.equal(PositionType.Short);

    await marginlyPool.connect(owner).setRecoveryMode(true);
    await marginlyPool.connect(depositer).reinit();

    shortPosition = await marginlyPool.positions(shorter.address);
    expect(shortPosition._type).to.be.equal(PositionType.Uninitialized);
  });

  it('reinit long position in Recovery mode', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, longer, depositer] = await ethers.getSigners();

    const depositAmount = 40000;
    await marginlyPool.connect(depositer).depositBase(depositAmount);
    await marginlyPool.connect(depositer).depositQuote(depositAmount);

    const baseCollateral = 100;
    await marginlyPool.connect(longer).depositBase(baseCollateral);

    const longAmount = 1700; // leverage 17.3
    await marginlyPool.connect(longer).long(longAmount);

    let longPosition = await marginlyPool.positions(longer.address);

    const leverage = calcLeverageLong(
      (await marginlyPool.getBasePrice()).inner,
      await marginlyPool.quoteCollateralCoeff(),
      await marginlyPool.baseDebtCoeff(),
      longPosition.discountedQuoteAmount,
      longPosition.discountedBaseAmount
    );
    console.log(toHumanString(leverage));

    await marginlyPool.connect(depositer).reinit();
    longPosition = await marginlyPool.positions(longer.address);
    expect(longPosition._type).to.be.equal(PositionType.Long);

    await marginlyPool.connect(owner).setRecoveryMode(true);
    await marginlyPool.connect(depositer).reinit();

    longPosition = await marginlyPool.positions(longer.address);
    expect(longPosition._type).to.be.equal(PositionType.Uninitialized);
  });

  it('receive short position in recovery mode', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, shorter, depositer, receiver] = await ethers.getSigners();

    const depositAmount = 20000;
    await marginlyPool.connect(depositer).depositBase(depositAmount);
    await marginlyPool.connect(depositer).depositQuote(depositAmount);

    const shorterCollateral = 100;
    await marginlyPool.connect(shorter).depositQuote(shorterCollateral);

    const shortAmount = 6500; // leverage 17.24
    await marginlyPool.connect(shorter).short(shortAmount);

    let shortPosition = await marginlyPool.positions(shorter.address);

    await expect(marginlyPool.connect(receiver).receivePosition(shorter.address, 0, 500)).to.be.rejectedWith('NL');

    await marginlyPool.connect(owner).setRecoveryMode(true);
    await marginlyPool.connect(receiver).receivePosition(shorter.address, 0, 500);

    shortPosition = await marginlyPool.positions(shorter.address);
    expect(shortPosition._type).to.be.equal(PositionType.Uninitialized);

    const receiverPosition = await marginlyPool.positions(receiver.address);
    expect(receiverPosition._type).to.be.equal(PositionType.Short);
  });

  it('receive long position in recovery mode', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, longer, depositer, receiver] = await ethers.getSigners();

    const depositAmount = 40000;
    await marginlyPool.connect(depositer).depositBase(depositAmount);
    await marginlyPool.connect(depositer).depositQuote(depositAmount);

    const baseCollateral = 100;
    await marginlyPool.connect(longer).depositBase(baseCollateral);

    const longAmount = 1700; // leverage 17.3
    await marginlyPool.connect(longer).long(longAmount);

    await expect(marginlyPool.connect(receiver).receivePosition(longer.address, 0, 200)).to.be.rejectedWith('NL');

    await marginlyPool.connect(owner).setRecoveryMode(true);
    await marginlyPool.connect(receiver).receivePosition(longer.address, 0, 200);

    const longPosition = await marginlyPool.positions(longer.address);
    expect(longPosition._type).to.be.equal(PositionType.Uninitialized);

    const receiverPosition = await marginlyPool.positions(receiver.address);
    expect(receiverPosition._type).to.be.equal(PositionType.Long);
  });
});
