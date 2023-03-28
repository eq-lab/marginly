import { createMarginlyPool, getInitializedPool } from './shared/fixtures';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import snapshotGasCost from '@uniswap/snapshot-gas-cost';
import { BigNumber } from 'ethers';
import { toHumanString } from './shared/utils';
import { expect } from 'chai';

describe('Open position:', () => {
  it('depositBase', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer] = await ethers.getSigners();
    const depositAmount = 1000;

    await snapshotGasCost(await marginlyPool.connect(signer).depositBase(depositAmount));
  });

  it('depositQuote', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer] = await ethers.getSigners();
    const depositAmount = 1000;

    await snapshotGasCost(await marginlyPool.connect(signer).depositQuote(depositAmount));
  });
});

describe('Deposit into existing position:', () => {
  it('depositBase', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer1] = await ethers.getSigners();
    const firstDeposit = 2468;
    const secondDeposit = 2837;

    await marginlyPool.connect(signer1).depositBase(firstDeposit);
    await snapshotGasCost(marginlyPool.connect(signer1).depositBase(secondDeposit));
  });

  it('depositQuote', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer1] = await ethers.getSigners();
    const firstDeposit = 2468;
    const secondDeposit = 2837;

    await marginlyPool.connect(signer1).depositQuote(firstDeposit);
    await snapshotGasCost(marginlyPool.connect(signer1).depositQuote(secondDeposit));
  });
});

describe('System initialized:', async () => {
  it('long', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const longer = wallets[0];
    await marginlyPool.connect(longer).depositBase(1000);
    await snapshotGasCost(marginlyPool.connect(longer).long(900));
  });

  it('short', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const shorter = wallets[0];
    await marginlyPool.connect(shorter).depositQuote(3000);
    await snapshotGasCost(marginlyPool.connect(shorter).short(400));
  });

  it('depositBase', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const lender = wallets[0];
    await snapshotGasCost(marginlyPool.connect(lender).depositBase(100));
  });

  it('depositQuote', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const lender = wallets[0];
    await snapshotGasCost(marginlyPool.connect(lender).depositQuote(3000));
  });

  it('closePosition', async () => {
    const { marginlyPool } = await loadFixture(getInitializedPool);
    const signers = await ethers.getSigners();
    const borrower = signers[signers.length - 1];
    await snapshotGasCost(marginlyPool.connect(borrower).closePosition());
  });

  it('withdrawBase', async () => {
    const { marginlyPool } = await loadFixture(getInitializedPool);
    const signers = await ethers.getSigners();
    const longer = signers[signers.length - 1];
    await snapshotGasCost(marginlyPool.connect(longer).withdrawBase(100));
  });

  it('withdrawQuote', async () => {
    const { marginlyPool } = await loadFixture(getInitializedPool);
    const signers = await ethers.getSigners();
    const shorter = signers[11];
    await snapshotGasCost(marginlyPool.connect(shorter).withdrawQuote(100));
  });
});

describe('mc happens:', async () => {
  it('depositBase with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, depositer, lender] = await ethers.getSigners();
    await marginlyPool.connect(longer).depositBase(1000);
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).depositQuote(10 * longAmount);
    await marginlyPool.connect(longer).long(longAmount);
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(depositer).depositBase(1000));
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(BigNumber.from(0));
  });

  it('depositQuote with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, depositer, lender] = await ethers.getSigners();
    await marginlyPool.connect(longer).depositBase(1000);
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).depositQuote(10 * longAmount);
    await marginlyPool.connect(longer).long(longAmount);
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(depositer).depositQuote(1000));
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(BigNumber.from(0));
  });

  it('short with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, depositer, longer, shorter] = await ethers.getSigners();

    await marginlyPool.connect(depositer).depositBase(100);

    await marginlyPool.connect(longer).depositBase(1000);
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(shorter).depositQuote(10 * longAmount);
    await marginlyPool.connect(longer).long(longAmount);
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(shorter).short(10));
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(BigNumber.from(0));
  });

  it('long with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, depositer, longer, lender, shorter] = await ethers.getSigners();
    await marginlyPool.connect(depositer).depositQuote(100);
    await marginlyPool.connect(longer).depositBase(1000);
    await marginlyPool.connect(shorter).depositQuote(1000);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).depositBase(3 * shortAmount);
    await marginlyPool.connect(shorter).short(shortAmount);
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(longer).long(10));
    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(BigNumber.from(0));
  });

  it('long initialized heap with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, lender, longer2] = await ethers.getSigners();
    await marginlyPool.connect(longer).depositBase(1000);
    await marginlyPool.connect(longer2).depositBase(1000);
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).depositQuote(3 * longAmount);
    await marginlyPool.connect(longer).long(longAmount);
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(longer2).long(10));
    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(BigNumber.from(0));
  });

  it('long closePosition with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, longer, lender, longer2] = await ethers.getSigners();
    const params = await marginlyPool.params();
    await marginlyPool.connect(owner).setParameters({ ...params, positionMinAmount: 1 });
    await marginlyPool.connect(longer).depositBase(1000);
    await marginlyPool.connect(longer2).depositBase(1000);
    await marginlyPool.connect(longer2).long(1);
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).depositQuote(3 * longAmount);
    await marginlyPool.connect(longer).long(longAmount);
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(longer2).closePosition());
    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(BigNumber.from(0));
  });

  it('depositBase with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, shorter, lender, depositer] = await ethers.getSigners();
    await marginlyPool.connect(longer).depositBase(1000);
    await marginlyPool.connect(shorter).depositQuote(1000);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).depositBase(3 * shortAmount);
    await marginlyPool.connect(shorter).short(shortAmount);
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).depositQuote(Math.floor(20 * longAmount * price));
    await marginlyPool.connect(longer).long(longAmount);
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(depositer).depositBase(1000));
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('depositQuote with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, shorter, lender, depositer] = await ethers.getSigners();
    await marginlyPool.connect(longer).depositBase(1000);
    await marginlyPool.connect(shorter).depositQuote(1000);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).depositBase(3 * shortAmount);
    await marginlyPool.connect(shorter).short(shortAmount);
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).depositQuote(Math.floor(20 * longAmount * price));
    await marginlyPool.connect(longer).long(longAmount);
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(depositer).depositQuote(1000));
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('short with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, shorter, shorter2, lender, depositer] = await ethers.getSigners();
    await marginlyPool.connect(longer).depositBase(1000);
    await marginlyPool.connect(shorter).depositQuote(1000);
    await marginlyPool.connect(shorter2).depositQuote(1000);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).depositBase(3 * shortAmount);
    await marginlyPool.connect(shorter).short(shortAmount);
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).depositQuote(Math.floor(20 * longAmount * price));
    await marginlyPool.connect(longer).long(longAmount);
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(shorter2).short(10));
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('long with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, longer2, shorter, lender, depositer] = await ethers.getSigners();
    await marginlyPool.connect(longer).depositBase(1000);
    await marginlyPool.connect(longer2).depositBase(1000);
    await marginlyPool.connect(shorter).depositQuote(1000);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).depositBase(3 * shortAmount);
    await marginlyPool.connect(shorter).short(shortAmount);
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).depositQuote(Math.floor(20 * longAmount * price));
    await marginlyPool.connect(longer).long(longAmount);
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(longer2).long(10));
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('closePosition with two mc', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createMarginlyPool);
    const [owner, longer, longer2, shorter, lender, depositer] = await ethers.getSigners();
    const params = await marginlyPool.params();
    await marginlyPool.connect(owner).setParameters({ ...params, positionMinAmount: 1 });
    await marginlyPool.connect(longer).depositBase(1000);
    await marginlyPool.connect(longer2).depositBase(1000);
    await marginlyPool.connect(shorter).depositQuote(1000);
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const price = +toHumanString(BigNumber.from((await marginlyPool.getBasePrice()).inner));
    const shortAmount = Math.floor(((lev - 1) * 1000) / price);
    await marginlyPool.connect(lender).depositBase(3 * shortAmount);
    await marginlyPool.connect(shorter).short(shortAmount);
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool.connect(lender).depositQuote(Math.floor(20 * longAmount * price));
    await marginlyPool.connect(longer2).long(1);
    await marginlyPool.connect(longer).long(longAmount);
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(await marginlyPool.connect(longer2).closePosition());
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });
});

describe('Liquidation', () => {
  it('liquidate long position and create new position', async () => {
    const {
      marginlyPool,
      wallets: [longer, receiver],
    } = await loadFixture(getInitializedPool);

    const baseCollateral = 100;
    await marginlyPool.connect(longer).depositBase(baseCollateral);

    const longAmount = 1970; // leverage 19.8
    await marginlyPool.connect(longer).long(longAmount);

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 3000;
    const baseAmount = 0;
    await snapshotGasCost(marginlyPool.connect(receiver).receivePosition(longer.address, quoteAmount, baseAmount));
  });

  it('liquidate short position and create new position', async () => {
    const {
      marginlyPool,
      wallets: [shorter, receiver],
    } = await loadFixture(getInitializedPool);

    const shorterCollateral = 100;
    await marginlyPool.connect(shorter).depositQuote(shorterCollateral);

    const shortAmount = 7600; // leverage 19.9
    await marginlyPool.connect(shorter).short(shortAmount);

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 356;
    const baseAmount = 7700; // the sum is enough to cover debt + accruedInterest
    await snapshotGasCost(marginlyPool.connect(receiver).receivePosition(shorter.address, quoteAmount, baseAmount));
  });

  it('liquidate long position and create new long position', async () => {
    const {
      marginlyPool,
      wallets: [longer, receiver],
    } = await loadFixture(getInitializedPool);

    const baseCollateral = 100;
    await marginlyPool.connect(longer).depositBase(baseCollateral);

    const longAmount = 1970; // leverage 19.8
    await marginlyPool.connect(longer).long(longAmount);

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 200; // the sum is not enough to cover bad position debt
    const baseAmount = 0;
    await snapshotGasCost(marginlyPool.connect(receiver).receivePosition(longer.address, quoteAmount, baseAmount));
  });

  it('liquidate short position and create new short position', async () => {
    const {
      marginlyPool,
      wallets: [shorter, receiver],
    } = await loadFixture(getInitializedPool);

    const shorterCollateral = 100;
    await marginlyPool.connect(shorter).depositQuote(shorterCollateral);

    const shortAmount = 7600; // leverage 19.9
    await marginlyPool.connect(shorter).short(shortAmount);

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 1000; // the sum is enough to improove position leverage
    const baseAmount = 100; // the sum is not enough to cover debt + accruedInterest
    await snapshotGasCost(marginlyPool.connect(receiver).receivePosition(shorter.address, quoteAmount, baseAmount));
  });
});
