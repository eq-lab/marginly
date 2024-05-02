import { createMarginlyPool, getInitializedPool } from './shared/fixtures';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import snapshotGasCost from '@uniswap/snapshot-gas-cost';
import { BigNumber } from 'ethers';
import {
  CallType,
  paramsDefaultLeverageWithoutIr,
  paramsLowLeverageWithIr,
  toHumanString,
  ZERO_ADDRESS,
  uniswapV3Swapdata,
} from './shared/utils';
import { expect } from 'chai';

describe('Open position:', () => {
  it('depositBase', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    const depositAmount = 1000;

    await snapshotGasCost(
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, depositAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('depositQuote', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    const depositAmount = 1000;

    await snapshotGasCost(
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, depositAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });
});

describe('Deposit into existing position:', () => {
  it('depositBase', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer1] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    const firstDeposit = 2468;
    const secondDeposit = 2837;

    await marginlyPool
      .connect(signer1)
      .execute(CallType.DepositBase, firstDeposit, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await snapshotGasCost(
      marginlyPool
        .connect(signer1)
        .execute(CallType.DepositBase, secondDeposit, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('depositQuote', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer1] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    const firstDeposit = 2468;
    const secondDeposit = 2837;

    await marginlyPool
      .connect(signer1)
      .execute(CallType.DepositQuote, firstDeposit, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await snapshotGasCost(
      marginlyPool
        .connect(signer1)
        .execute(CallType.DepositQuote, secondDeposit, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });
});

describe('System initialized:', async () => {
  it('long', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const price = (await marginlyPool.getBasePrice()).inner;
    const longer = wallets[0];
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await snapshotGasCost(
      marginlyPool.connect(longer).execute(CallType.Long, 900, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('long with flip', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const price = (await marginlyPool.getBasePrice()).inner;
    const longer = wallets[0];
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await snapshotGasCost(
      marginlyPool.connect(longer).execute(CallType.Long, 900, 0, price, true, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('short', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const price = (await marginlyPool.getBasePrice()).inner;
    const shorter = wallets[0];
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 3000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await snapshotGasCost(
      marginlyPool.connect(shorter).execute(CallType.Short, 400, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('short with flip', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const price = (await marginlyPool.getBasePrice()).inner;
    const shorter = wallets[0];
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositBase, 3000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await snapshotGasCost(
      marginlyPool.connect(shorter).execute(CallType.Short, 400, 0, price, true, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('depositBase', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const price = (await marginlyPool.getBasePrice()).inner;
    const lender = wallets[0];
    await snapshotGasCost(
      marginlyPool
        .connect(lender)
        .execute(CallType.DepositBase, 100, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('depositBase and long', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const price = (await marginlyPool.getBasePrice()).inner;
    const lender = wallets[0];
    await snapshotGasCost(
      marginlyPool
        .connect(lender)
        .execute(CallType.DepositBase, 100, 150, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('depositQuote', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const price = (await marginlyPool.getBasePrice()).inner;
    const lender = wallets[0];
    await snapshotGasCost(
      marginlyPool
        .connect(lender)
        .execute(CallType.DepositQuote, 3000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('depositQuote and short', async () => {
    const { marginlyPool, wallets } = await loadFixture(getInitializedPool);
    const price = (await marginlyPool.getBasePrice()).inner;
    const lender = wallets[0];
    await snapshotGasCost(
      marginlyPool
        .connect(lender)
        .execute(CallType.DepositQuote, 3000, 1000, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('closePosition', async () => {
    const { marginlyPool, shorters } = await loadFixture(getInitializedPool);
    const price = (await marginlyPool.getBasePrice()).inner;
    const borrower = shorters[0];
    await snapshotGasCost(
      marginlyPool
        .connect(borrower)
        .execute(CallType.ClosePosition, 0, 0, price.mul(101).div(100), false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('withdrawBase', async () => {
    const { marginlyPool, longers } = await loadFixture(getInitializedPool);
    const price = (await marginlyPool.getBasePrice()).inner;
    const longer = longers[0];
    await snapshotGasCost(
      marginlyPool
        .connect(longer)
        .execute(CallType.WithdrawBase, 100, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });

  it('withdrawQuote', async () => {
    const { marginlyPool } = await loadFixture(getInitializedPool);
    const price = (await marginlyPool.getBasePrice()).inner;
    const signers = await ethers.getSigners();
    const shorter = signers[11];
    await snapshotGasCost(
      marginlyPool
        .connect(shorter)
        .execute(CallType.WithdrawQuote, 100, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
  });
});

describe('mc happens:', async () => {
  it('depositBase with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, depositor, lender] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 10 * longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(BigNumber.from(0));
  });

  it('depositQuote with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, depositor, lender] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 10 * longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(BigNumber.from(0));
  });

  it('short with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, depositor, longer, shorter] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    await marginlyPool
      .connect(depositor)
      .execute(CallType.DepositBase, 100, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 10 * longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool
        .connect(shorter)
        .execute(CallType.Short, 10, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
    expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(BigNumber.from(0));
  });

  it('long with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, depositor, longer, lender, shorter] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    await marginlyPool
      .connect(depositor)
      .execute(CallType.DepositQuote, 100, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const calcPrice = +toHumanString(price);
    const shortAmount = Math.floor(((lev - 1) * 1000) / calcPrice);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 3 * shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.Short, shortAmount, 0, price.mul(99).div(100), false, ZERO_ADDRESS, uniswapV3Swapdata());
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool.connect(longer).execute(CallType.Long, 10, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(BigNumber.from(0));
  });

  it('long initialized heap with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, lender, longer2] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(longer2)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 3 * longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await time.increase(24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool.connect(longer2).execute(CallType.Long, 10, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(BigNumber.from(0));
  });

  it('long closePosition with one mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, longer, lender, longer2] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    const params = await marginlyPool.params();
    await marginlyPool.connect(owner).setParameters({ ...params, positionMinAmount: 10 });

    const lev = (await marginlyPool.params()).maxLeverage - 0.25;
    const longAmount = Math.floor((lev - 1) * 1000);

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 3 * longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(longer2)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool.connect(longer2).execute(CallType.Long, 10, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await time.increase(24 * 60 * 60);

    await snapshotGasCost(
      await marginlyPool
        .connect(longer2)
        .execute(CallType.ClosePosition, 0, 0, price.mul(99).div(100), false, ZERO_ADDRESS, uniswapV3Swapdata())
    );

    expect(await marginlyPool.discountedBaseDebt()).to.be.equal(BigNumber.from(0));
  });

  it('depositBase with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, shorter, lender, depositor] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const calcPrice = +toHumanString(price);
    const shortAmount = Math.floor(((lev - 1) * 1000) / calcPrice);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 3 * shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.Short, shortAmount, 0, price.mul(99).div(100), false, ZERO_ADDRESS, uniswapV3Swapdata());
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(
        CallType.DepositQuote,
        Math.floor(20 * longAmount * calcPrice),
        0,
        price,
        false,
        ZERO_ADDRESS,
        uniswapV3Swapdata()
      );
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('depositQuote with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, shorter, lender, depositor] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const calcPrice = +toHumanString(price);
    const shortAmount = Math.floor(((lev - 1) * 1000) / calcPrice);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 3 * shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(
        CallType.DepositQuote,
        Math.floor(20 * longAmount * calcPrice),
        0,
        price,
        false,
        ZERO_ADDRESS,
        uniswapV3Swapdata()
      );
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('short with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, shorter, shorter2, lender, depositor] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter2)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const calcPrice = +toHumanString(price);
    const shortAmount = Math.floor(((lev - 1) * 1000) / calcPrice);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 3 * shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.Short, shortAmount, 0, price.mul(99).div(100), false, ZERO_ADDRESS, uniswapV3Swapdata());
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(
        CallType.DepositQuote,
        Math.floor(20 * longAmount * calcPrice),
        0,
        price,
        false,
        ZERO_ADDRESS,
        uniswapV3Swapdata()
      );
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool
        .connect(shorter2)
        .execute(CallType.Short, 10, 0, price.mul(99).div(100), false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('long with two mc', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, longer, longer2, shorter, lender, depositor] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(longer2)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const calcPrice = +toHumanString(price);
    const shortAmount = Math.floor(((lev - 1) * 1000) / calcPrice);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 3 * shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.Short, shortAmount, 0, price.mul(99).div(100), false, ZERO_ADDRESS, uniswapV3Swapdata());
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(
        CallType.DepositQuote,
        Math.floor(20 * longAmount * calcPrice),
        0,
        price,
        false,
        ZERO_ADDRESS,
        uniswapV3Swapdata()
      );
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool.connect(longer2).execute(CallType.Long, 10, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('closePosition with two mc', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createMarginlyPool);
    const [owner, longer, longer2, shorter, lender, depositor] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    const params = await marginlyPool.params();
    await marginlyPool.connect(owner).setParameters({ ...params, positionMinAmount: 10 });
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(longer2)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    const lev = (await marginlyPool.params()).maxLeverage - 1;
    const calcPrice = +toHumanString(price);
    const shortAmount = Math.floor(((lev - 1) * 1000) / calcPrice);
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 3 * shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(shorter)
      .execute(CallType.Short, shortAmount, 0, price.mul(99).div(100), false, ZERO_ADDRESS, uniswapV3Swapdata());
    const longAmount = Math.floor((lev - 1) * 1000);
    await marginlyPool
      .connect(lender)
      .execute(
        CallType.DepositQuote,
        Math.floor(20 * longAmount * calcPrice),
        0,
        price,
        false,
        ZERO_ADDRESS,
        uniswapV3Swapdata()
      );
    await marginlyPool.connect(longer2).execute(CallType.Long, 10, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await time.increase(180 * 24 * 60 * 60);
    await snapshotGasCost(
      await marginlyPool
        .connect(longer2)
        .execute(CallType.ClosePosition, 0, 0, price.mul(99).div(100), false, ZERO_ADDRESS, uniswapV3Swapdata())
    );
    expect((await marginlyPool.positions(shorter.address)).discountedBaseAmount).to.be.equal(BigNumber.from(0));
    expect((await marginlyPool.positions(longer.address)).discountedQuoteAmount).to.be.equal(BigNumber.from(0));
  });

  it('MC long position with deleverage', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(createMarginlyPool);

    await marginlyPool.connect(factoryOwner).setParameters(paramsDefaultLeverageWithoutIr);

    const accounts = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

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

    const quoteDelevCoeffBefore = await marginlyPool.quoteDelevCoeff();

    await marginlyPool.connect(factoryOwner).setParameters(paramsLowLeverageWithIr);
    await snapshotGasCost(
      await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );

    expect(await marginlyPool.quoteDelevCoeff()).to.be.greaterThan(quoteDelevCoeffBefore);
  });

  it('MC short position with deleverage', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(createMarginlyPool);

    await marginlyPool.connect(factoryOwner).setParameters(paramsDefaultLeverageWithoutIr);

    const accounts = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

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

    const baseDelevCoeffBefore = await marginlyPool.quoteDelevCoeff();

    await marginlyPool.connect(factoryOwner).setParameters(paramsLowLeverageWithIr);
    await snapshotGasCost(
      await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );

    expect(await marginlyPool.baseDelevCoeff()).to.be.greaterThan(baseDelevCoeffBefore);
  });

  it('MC long reinit', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(createMarginlyPool);

    await marginlyPool.connect(factoryOwner).setParameters(paramsDefaultLeverageWithoutIr);

    const accounts = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

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

    await marginlyPool.connect(factoryOwner).setParameters(paramsLowLeverageWithIr);
    await snapshotGasCost(
      await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );

    const position = await marginlyPool.positions(longer.address);
    expect(position._type).to.be.equal(0);
  });

  it('MC short reinit', async () => {
    const { marginlyPool, factoryOwner } = await loadFixture(createMarginlyPool);

    await marginlyPool.connect(factoryOwner).setParameters(paramsDefaultLeverageWithoutIr);

    const accounts = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

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

    await marginlyPool.connect(factoryOwner).setParameters(paramsLowLeverageWithIr);
    await snapshotGasCost(
      await marginlyPool.connect(lender).execute(CallType.Reinit, 0, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata())
    );

    const position = await marginlyPool.positions(shorter.address);
    expect(position._type).to.be.equal(0);
  });
});

describe('Liquidation', () => {
  it('liquidate long position and create new position', async () => {
    const {
      marginlyPool,
      wallets: [longer, receiver],
    } = await loadFixture(getInitializedPool);

    const price = (await marginlyPool.getBasePrice()).inner;

    const baseCollateral = 100;
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, baseCollateral, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const longAmount = 1970; // leverage 19.8
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 3000;
    const baseAmount = 0;
    await snapshotGasCost(
      marginlyPool
        .connect(receiver)
        .execute(CallType.ReceivePosition, quoteAmount, baseAmount, price, false, longer.address, uniswapV3Swapdata())
    );
  });

  it('liquidate short position and create new position', async () => {
    const {
      marginlyPool,
      wallets: [shorter, receiver],
    } = await loadFixture(getInitializedPool);

    const price = (await marginlyPool.getBasePrice()).inner;

    const shorterCollateral = 100;
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, shorterCollateral, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const shortAmount = 7500; // leverage 19.9
    await marginlyPool
      .connect(shorter)
      .execute(CallType.Short, shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 356;
    const baseAmount = 7700; // the sum is enough to cover debt + accruedInterest
    await snapshotGasCost(
      marginlyPool
        .connect(receiver)
        .execute(CallType.ReceivePosition, quoteAmount, baseAmount, price, false, shorter.address, uniswapV3Swapdata())
    );
  });

  it('liquidate long position and create new long position', async () => {
    const {
      marginlyPool,
      wallets: [longer, receiver],
    } = await loadFixture(getInitializedPool);

    const price = (await marginlyPool.getBasePrice()).inner;

    const baseCollateral = 100;
    await marginlyPool
      .connect(longer)
      .execute(CallType.DepositBase, baseCollateral, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const longAmount = 1970; // leverage 19.8
    await marginlyPool
      .connect(longer)
      .execute(CallType.Long, longAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 200; // the sum is not enough to cover bad position debt
    const baseAmount = 0;
    await snapshotGasCost(
      marginlyPool
        .connect(receiver)
        .execute(CallType.ReceivePosition, quoteAmount, baseAmount, price, false, longer.address, uniswapV3Swapdata())
    );
  });

  it('liquidate short position and create new short position', async () => {
    const {
      marginlyPool,
      wallets: [shorter, receiver],
    } = await loadFixture(getInitializedPool);

    const price = (await marginlyPool.getBasePrice()).inner;

    const shorterCollateral = 100;
    await marginlyPool
      .connect(shorter)
      .execute(CallType.DepositQuote, shorterCollateral, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const shortAmount = 7500; // leverage 19.9
    await marginlyPool
      .connect(shorter)
      .execute(CallType.Short, shortAmount, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await time.increase(timeShift);

    const quoteAmount = 1000; // the sum is enough to improve position leverage
    const baseAmount = 100; // the sum is not enough to cover debt + accruedInterest
    await snapshotGasCost(
      marginlyPool
        .connect(receiver)
        .execute(CallType.ReceivePosition, quoteAmount, baseAmount, price, false, shorter.address, uniswapV3Swapdata())
    );
  });
});
