import { createMarginlyPool, TechnicalPositionOwner } from './shared/fixtures';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { CallType, FP96, MarginlyPoolMode, ZERO_ADDRESS, uniswapV3Swapdata } from './shared/utils';

describe('MarginlyPool.Blast', () => {
  it('Rebase amount base gt min amount', async () => {
    const { marginlyPool, baseContract } = await loadFixture(createMarginlyPool);
    const [_, depositor] = await ethers.getSigners();
    const minAmount = (await marginlyPool.params()).positionMinAmount;

    const depositAmount = 1000;
    await marginlyPool
      .connect(depositor)
      .execute(CallType.DepositBase, depositAmount, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const rebaseAmount = minAmount.mul(3).div(2);
    await baseContract.mint(marginlyPool.address, rebaseAmount);

    const baseCollCoeffBefore = await marginlyPool.baseCollateralCoeff();

    await marginlyPool.connect(depositor).execute(CallType.Reinit, 0, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const baseCollCoeffAfter = await marginlyPool.baseCollateralCoeff();
    const baseCollCoeffFactor = rebaseAmount.sub(minAmount).mul(FP96.one).div(depositAmount).add(FP96.one);
    expect(baseCollCoeffAfter).to.be.eq(baseCollCoeffBefore.mul(baseCollCoeffFactor).div(FP96.one));
  });

  it('Rebase amount base lt min amount', async () => {
    const { marginlyPool, baseContract } = await loadFixture(createMarginlyPool);
    const [_, depositor] = await ethers.getSigners();
    const minAmount = (await marginlyPool.params()).positionMinAmount;

    const depositAmount = 1000;
    await marginlyPool
      .connect(depositor)
      .execute(CallType.DepositBase, depositAmount, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const rebaseAmount = minAmount.mul(1).div(2);
    await baseContract.mint(marginlyPool.address, rebaseAmount);

    const baseCollCoeffBefore = await marginlyPool.baseCollateralCoeff();

    await marginlyPool.connect(depositor).execute(CallType.Reinit, 0, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const baseCollCoeffAfter = await marginlyPool.baseCollateralCoeff();
    expect(baseCollCoeffAfter).to.be.eq(baseCollCoeffBefore);
  });

  it('Rebase amount quote gt min amount', async () => {
    const { marginlyPool, quoteContract } = await loadFixture(createMarginlyPool);
    const [_, depositor] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    const minAmount = (await marginlyPool.params()).positionMinAmount.mul(price).div(FP96.one);

    const depositAmount = 1000;
    await marginlyPool
      .connect(depositor)
      .execute(CallType.DepositQuote, depositAmount, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const rebaseAmount = minAmount.mul(3).div(2);
    await quoteContract.mint(marginlyPool.address, rebaseAmount);

    const quoteCollCoeffBefore = await marginlyPool.quoteCollateralCoeff();

    await marginlyPool.connect(depositor).execute(CallType.Reinit, 0, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const quoteCollCoeffAfter = await marginlyPool.quoteCollateralCoeff();
    const quoteCollCoeffFactor = rebaseAmount.sub(minAmount).mul(FP96.one).div(depositAmount).add(FP96.one);

    expect(quoteCollCoeffAfter).to.be.eq(quoteCollCoeffBefore.mul(quoteCollCoeffFactor).div(FP96.one));
  });

  it('Rebase amount quote lt min amount', async () => {
    const { marginlyPool, quoteContract } = await loadFixture(createMarginlyPool);
    const [_, depositor] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    const minAmount = (await marginlyPool.params()).positionMinAmount.mul(price).div(FP96.one);

    const depositAmount = 1000;
    await marginlyPool
      .connect(depositor)
      .execute(CallType.DepositQuote, depositAmount, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const rebaseAmount = minAmount.mul(1).div(2);
    await quoteContract.mint(marginlyPool.address, rebaseAmount);

    const quoteCollCoeffBefore = await marginlyPool.quoteCollateralCoeff();

    await marginlyPool.connect(depositor).execute(CallType.Reinit, 0, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const quoteCollCoeffAfter = await marginlyPool.quoteCollateralCoeff();

    expect(quoteCollCoeffAfter).to.be.eq(quoteCollCoeffBefore);
  });
});
