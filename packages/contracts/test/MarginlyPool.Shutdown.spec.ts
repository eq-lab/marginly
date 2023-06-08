import { createMarginlyPool, createTimeMoveMarginlyPool, increatePoolTimestamp } from './shared/fixtures';
import { loadFixture } from './shared/mocks';
import { expect } from 'chai';
import { ethers } from './shared/mocks';
import { CallType, FP96, MarginlyPoolMode, ZERO_ADDRESS } from './shared/utils';

describe('MarginlyPool.Shutdown', () => {
  it('should revert when collateral enough', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, depositor] = await ethers.getSigners();

    const amountToDeposit = 100;
    await (await marginlyPool.connect(depositor).execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS)).wait();

    expect(marginlyPool.connect(owner).shutDown()).to.be.rejectedWith('NE');
  });

  it('should not allow reinit in ShortEmergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [owner, depositor, shorter] = await ethers.getSigners();

    await (await pool.setParityPrice()).wait();

    const amountToDeposit = 100;
    await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();

    const shortAmount = 100;
    await (await marginlyPool.connect(shorter).depositQuote(amountToDeposit, shortAmount)).wait();

    //Quote price lower than Base price
    await (await pool.setPriceQuoteLowerThanBase()).wait();

    //wait for accrue interest
    const timeShift = 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    expect(marginlyPool.reinit()).to.be.rejected;
  });

  it('should switch system in ShortEmergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [owner, depositor, shorter] = await ethers.getSigners();

    await (await pool.setParityPrice()).wait();

    const amountToDeposit = 100;
    await (await marginlyPool.connect(depositor).execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS)).wait();

    const shortAmount = 100;
    await (await marginlyPool.connect(shorter).execute(CallType.DepositQuote, amountToDeposit, shortAmount, false, ZERO_ADDRESS)).wait();

    //Quote price lower than Base price
    await (await pool.setPriceQuoteLowerThanBase()).wait();

    //wait for accrue interest
    const timeShift = 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    await expect(marginlyPool.execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS)).to.be.rejected;

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
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [owner, depositor, longer] = await ethers.getSigners();

    await (await pool.setParityPrice()).wait();

    const amountToDeposit = 100;
    await (await marginlyPool.connect(depositor).execute(CallType.DepositQuote, amountToDeposit, 0)).wait(, false, ZERO_ADDRESS);

    const longAmount = 100;
    await (await marginlyPool.connect(longer).execute(CallType.DepositBase, amountToDeposit, longAmount)).wait(, false, ZERO_ADDRESS);

    //Base price lower than Quote price
    await (await pool.setPriceQuoteBiggerThanBase()).wait();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    await (await marginlyPool.connect(owner).shutDown()).wait();
    expect(await marginlyPool.mode()).to.be.equals(MarginlyPoolMode.LongEmergency);
    expect(await marginlyPool.emergencyWithdrawCoeff()).not.to.be.equal(0);

    // can't switch second time to emergency mode
    expect(marginlyPool.shutDown()).to.be.rejectedWith('EM');
  });

  it('withdraw tokens for Long/Lend position in ShortEmergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
      baseContract,
      quoteContract,
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [owner, depositor, shorter, longer] = await ethers.getSigners();

    await (await pool.setParityPrice()).wait();

    const amountToDeposit = 100;
    await (await marginlyPool.connect(depositor).execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS)).wait();

    const shortAmount = 100;

    await (await marginlyPool.connect(shorter).execute(CallType.DepositQuote, amountToDeposit, shortAmount, false, ZERO_ADDRESS)).wait();

    await (await marginlyPool.connect(longer).execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS)).wait();
    const longAmount = 50;
    await (await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS)).wait();

    //Quote price lower than Base price
    await (await pool.setPriceQuoteLowerThanBase()).wait();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    await (await marginlyPool.connect(owner).shutDown()).wait();
    expect(await marginlyPool.mode()).to.be.equal(MarginlyPoolMode.ShortEmergency);

    const emergencyWithdrawCoeff = await marginlyPool.emergencyWithdrawCoeff();

    const longerBalanceBefore = await baseContract.balanceOf(longer.address);
    const depositorBalanceBefore = await baseContract.balanceOf(depositor.address);

    const depositorPosition = await marginlyPool.positions(depositor.address);

    const longerPosition = await marginlyPool.positions(longer.address);

    await (await marginlyPool.connect(depositor).execute(CallType.EmergencyWithdraw, 0, 0, false, ZERO_ADDRESS)).wait();
    await (await marginlyPool.connect(longer).execute(CallType.EmergencyWithdraw, 0, 0, false, ZERO_ADDRESS)).wait();

    const longerBalanceAfter = await baseContract.balanceOf(longer.address);
    const depositorBalanceAfter = await baseContract.balanceOf(depositor.address);
    const actualLongerBaseAmount = longerBalanceAfter.sub(longerBalanceBefore);
    const actualDepositorBaseAmount = depositorBalanceAfter.sub(depositorBalanceBefore);

    const expectedLongerBaseAmount = emergencyWithdrawCoeff.mul(longerPosition.discountedBaseAmount).div(FP96.one);
    const expectedDepositorBaseAmount = emergencyWithdrawCoeff
      .mul(depositorPosition.discountedBaseAmount)
      .div(FP96.one);

    expect(actualLongerBaseAmount).to.be.equal(expectedLongerBaseAmount);
    expect(actualDepositorBaseAmount).to.be.equal(expectedDepositorBaseAmount);

    const longerPositionAfter = await marginlyPool.positions(longer.address);
    expect(longerPositionAfter._type).to.be.equal(0);
    expect(longerPositionAfter.discountedBaseAmount).to.be.equal(0);
    expect(longerPositionAfter.discountedQuoteAmount).to.be.equal(0);

    const depositorPositionAfter = await marginlyPool.positions(depositor.address);
    expect(depositorPositionAfter._type).to.be.equal(0);
    expect(depositorPositionAfter.discountedBaseAmount).to.be.equal(0);
    expect(depositorPositionAfter.discountedQuoteAmount).to.be.equal(0);

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
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [owner, depositor, longer, shorter] = await ethers.getSigners();

    await (await pool.setParityPrice()).wait();

    const amountToDeposit = 100;
    await (await marginlyPool.connect(depositor).execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS)).wait();
    await (await marginlyPool.connect(depositor).execute(CallType.DepositBase, 10, 0, false, ZERO_ADDRESS)).wait();

    const longAmount = 100;
    await (await marginlyPool.connect(longer).execute(CallType.DepositBase, amountToDeposit, longAmount, false, ZERO_ADDRESS)).wait();

    const shortAmount = 50;
    await (await marginlyPool.connect(shorter).execute(CallType.DepositQuote, amountToDeposit, shortAmount, false, ZERO_ADDRESS)).wait();

    //Base price lower than Quote price
    await (await pool.setPriceQuoteBiggerThanBase()).wait();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    await (await marginlyPool.connect(owner).shutDown()).wait();
    expect(await marginlyPool.mode()).to.be.equal(MarginlyPoolMode.LongEmergency);

    const emergencyWithdrawCoeff = await marginlyPool.emergencyWithdrawCoeff();

    const shorterBalanceBefore = await quoteContract.balanceOf(shorter.address);
    const depositorBalanceBefore = await quoteContract.balanceOf(depositor.address);

    const depositorPosition = await marginlyPool.positions(depositor.address);

    const shorterPosition = await marginlyPool.positions(shorter.address);

    await (await marginlyPool.connect(depositor).execute(CallType.EmergencyWithdraw, 0, 0, false, ZERO_ADDRESS)).wait();
    await (await marginlyPool.connect(shorter).execute(CallType.EmergencyWithdraw, 0, 0, false, ZERO_ADDRESS)).wait();

    const shorterBalanceAfter = await quoteContract.balanceOf(shorter.address);
    const depositorBalanceAfter = await quoteContract.balanceOf(depositor.address);
    const actualShorterQuoteAmount = shorterBalanceAfter.sub(shorterBalanceBefore);
    const actualDepositorQuoteAmount = depositorBalanceAfter.sub(depositorBalanceBefore);

    const expectedShorterQuoteAmount = emergencyWithdrawCoeff.mul(shorterPosition.discountedQuoteAmount).div(FP96.one);

    const expectedDepositorQuoteAmount = emergencyWithdrawCoeff
      .mul(depositorPosition.discountedQuoteAmount)
      .div(FP96.one);

    expect(actualShorterQuoteAmount).to.be.equal(expectedShorterQuoteAmount);
    expect(actualDepositorQuoteAmount).to.be.equal(expectedDepositorQuoteAmount);

    const shorterPositionAfter = await marginlyPool.positions(shorter.address);
    expect(shorterPositionAfter._type).to.be.equal(0);
    expect(shorterPositionAfter.discountedBaseAmount).to.be.equal(0);
    expect(shorterPositionAfter.discountedQuoteAmount).to.be.equal(0);

    const depositorPositionAfter = await marginlyPool.positions(depositor.address);
    expect(depositorPositionAfter._type).to.be.equal(0);
    expect(depositorPositionAfter.discountedBaseAmount).to.be.equal(0);
    expect(depositorPositionAfter.discountedQuoteAmount).to.be.equal(0);

    const poolBaseBalance = await baseContract.balanceOf(marginlyPool.address);
    expect(poolBaseBalance).to.be.lessThanOrEqual(2);
    const poolQuoteBalance = await quoteContract.balanceOf(marginlyPool.address);
    expect(poolQuoteBalance).to.be.lessThanOrEqual(2);

    console.log(`pool state after withdraw: base=${poolBaseBalance} quote=${poolQuoteBalance}`);
  });

  it('should unwrap WETH to ETH when withdraw in Emergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [owner, depositor, shorter, longer] = await ethers.getSigners();

    await (await pool.setParityPrice()).wait();

    const amountToDeposit = 100;
    await (await marginlyPool.connect(depositor).execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS)).wait();

    const shortAmount = 100;

    await (await marginlyPool.connect(shorter).execute(CallType.DepositQuote, amountToDeposit, shortAmount, false, ZERO_ADDRESS)).wait();

    await (await marginlyPool.connect(longer).execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS)).wait();
    const longAmount = 50;
    await (await marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS)).wait();

    //Quote price lower than Base price
    await (await pool.setPriceQuoteLowerThanBase()).wait();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    await (await marginlyPool.connect(owner).shutDown()).wait();
    expect(await marginlyPool.mode()).to.be.equal(MarginlyPoolMode.ShortEmergency);

    const emergencyWithdrawCoeff = await marginlyPool.emergencyWithdrawCoeff();

    const depositorBalanceBefore = await depositor.getBalance();

    const depositorPosition = await marginlyPool.positions(depositor.address);

    const txReceipt = await (await marginlyPool.connect(depositor).execute(CallType.EmergencyWithdraw, 0, 0, true, ZERO_ADDRESS)).wait();
    const txFee = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);

    const depositorBalanceAfter = await depositor.getBalance();

    const expectedDepositorBaseAmount = emergencyWithdrawCoeff
      .mul(depositorPosition.discountedBaseAmount)
      .div(FP96.one);

    expect(depositorBalanceBefore.sub(txFee).add(expectedDepositorBaseAmount)).to.be.equal(depositorBalanceAfter);
  });

  it('should revert withdraw tokens from Short position in ShortEmergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [owner, depositor, shorter] = await ethers.getSigners();

    await (await pool.setParityPrice()).wait();

    const amountToDeposit = 100;
    await (await marginlyPool.connect(depositor).execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS)).wait();

    const shortAmount = 100;
    await (await marginlyPool.connect(shorter).execute(CallType.DepositQuote, amountToDeposit, shortAmount, false, ZERO_ADDRESS)).wait();

    //Quote price lower than Base price
    await (await pool.setPriceQuoteLowerThanBase()).wait();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    await (await marginlyPool.connect(owner).shutDown()).wait();
    expect(await marginlyPool.mode()).to.be.equal(MarginlyPoolMode.ShortEmergency);

    expect(marginlyPool.connect(shorter).execute(CallType.EmergencyWithdraw, 0, 0, false, ZERO_ADDRESS)).to.be.rejectedWith('SE');
  });

  it('should revert withdraw tokens from Long position in LongEmergency mode', async () => {
    const {
      marginlyPool,
      uniswapPoolInfo: { pool },
    } = await loadFixture(createTimeMoveMarginlyPool);
    const [owner, depositor, longer] = await ethers.getSigners();

    await (await pool.setParityPrice()).wait();

    const amountToDeposit = 100;
    await (await marginlyPool.connect(depositor).execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS)).wait();

    const longAmount = 100;
    await (await marginlyPool.connect(longer).execute(CallType.DepositBase, amountToDeposit, longAmount, false, ZERO_ADDRESS)).wait();

    //Base price lower than Quote price
    await (await pool.setPriceQuoteBiggerThanBase()).wait();

    //wait for accrue interest
    const timeShift = 20 * 24 * 60 * 60;
    await increatePoolTimestamp(marginlyPool, timeShift);

    await (await marginlyPool.connect(owner).shutDown()).wait();

    expect(marginlyPool.connect(longer).execute(CallType.EmergencyWithdraw, 0, 0, false, ZERO_ADDRESS)).to.be.rejectedWith('LE');
  });
});
