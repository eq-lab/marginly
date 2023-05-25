import { createMarginlyPool } from './shared/fixtures';
import { loadFixture } from './shared/mocks';
import { expect } from 'chai';
import { ethers } from './shared/mocks';
import { generateWallets } from './shared/utils';
import { parseUnits } from 'ethers/lib/utils';

describe('TestSwapRouter', () => {
  it('swap base to quote exact input', async () => {
    const { swapRouter, baseContract, quoteContract } = await loadFixture(createMarginlyPool);
    const [owner] = await ethers.getSigners();
    const [signer] = await generateWallets(1);

    await (await owner.sendTransaction({
      from: owner.address,
      to: signer.address,
      value: parseUnits('1', 18),
    })).wait();

    await (await baseContract.connect(signer).mint(signer.address, 100)).wait();
    await (await baseContract.connect(signer).approve(swapRouter.address, 100)).wait();

    console.log(`base balance = ${await baseContract.balanceOf(signer.address)}`);
    console.log(`quote balance = ${await quoteContract.balanceOf(signer.address)}`);

    await (await swapRouter.connect(signer).exactInputSingle({
      tokenIn: baseContract.address,
      tokenOut: quoteContract.address,
      amountIn: 100,
      amountOutMinimum: 0,
      deadline: 0,
      fee: 1,
      recipient: signer.address,
      sqrtPriceLimitX96: 0,
    })).wait();
    const quoteBalance = await quoteContract.balanceOf(signer.address);
    const baseBalance = await baseContract.balanceOf(signer.address);

    console.log(`after swap`);
    console.log(`base balance = ${baseBalance}`);
    console.log(`quote balance = ${quoteBalance}`);

    expect(quoteBalance).to.be.equal(25);
  });

  it('swap quote to base exact input', async () => {
    const { swapRouter, baseContract, quoteContract } = await loadFixture(createMarginlyPool);
    const [owner] = await ethers.getSigners();
    const [signer] = await generateWallets(1);

    await (await owner.sendTransaction({
      from: owner.address,
      to: signer.address,
      value: parseUnits('1', 18),
    })).wait();

    await (await quoteContract.connect(signer).mint(signer.address, 100)).wait();
    await (await quoteContract.connect(signer).approve(swapRouter.address, 100)).wait();

    console.log(`base balance = ${await baseContract.balanceOf(signer.address)}`);
    console.log(`quote balance = ${await quoteContract.balanceOf(signer.address)}`);

    await (await swapRouter.connect(signer).exactInputSingle({
      tokenIn: quoteContract.address,
      tokenOut: baseContract.address,
      amountIn: 100,
      amountOutMinimum: 0,
      deadline: 0,
      fee: 1,
      recipient: signer.address,
      sqrtPriceLimitX96: 0,
    })).wait();
    const quoteBalance = await quoteContract.balanceOf(signer.address);
    const baseBalance = await baseContract.balanceOf(signer.address);

    console.log(`after swap`);
    console.log(`base balance = ${baseBalance}`);
    console.log(`quote balance = ${quoteBalance}`);

    expect(baseBalance).to.be.equal(400);
  });

  it('swap base to quote exact output', async () => {
    const { swapRouter, baseContract, quoteContract } = await loadFixture(createMarginlyPool);
    const [owner] = await ethers.getSigners();
    const [signer] = await generateWallets(1);

    await (await owner.sendTransaction({
      from: owner.address,
      to: signer.address,
      value: parseUnits('1', 18),
    })).wait();

    await (await baseContract.connect(signer).mint(signer.address, 400)).wait();
    await (await baseContract.connect(signer).approve(swapRouter.address, 400)).wait();

    console.log(`base balance = ${await baseContract.balanceOf(signer.address)}`);
    console.log(`quote balance = ${await quoteContract.balanceOf(signer.address)}`);

    await (await swapRouter.connect(signer).exactOutputSingle({
      tokenIn: baseContract.address,
      tokenOut: quoteContract.address,
      amountInMaximum: 400,
      amountOut: 100,
      deadline: 0,
      fee: 0,
      recipient: signer.address,
      sqrtPriceLimitX96: 0,
    })).wait();
    const quoteBalance = await quoteContract.balanceOf(signer.address);
    const baseBalance = await baseContract.balanceOf(signer.address);

    console.log(`after swap`);
    console.log(`base balance = ${baseBalance}`);
    console.log(`quote balance = ${quoteBalance}`);

    expect(quoteBalance).to.be.equal(100);
    expect(baseBalance).to.be.equal(0);
  });

  it('swap quote to base exact output', async () => {
    const { swapRouter, baseContract, quoteContract } = await loadFixture(createMarginlyPool);
    const [owner] = await ethers.getSigners();
    const [signer] = await generateWallets(1);

    await (await owner.sendTransaction({
      from: owner.address,
      to: signer.address,
      value: parseUnits('1', 18),
    })).wait();

    await (await quoteContract.connect(signer).mint(signer.address, 100)).wait();
    await (await quoteContract.connect(signer).approve(swapRouter.address, 100)).wait();

    console.log(`base balance = ${await baseContract.balanceOf(signer.address)}`);
    console.log(`quote balance = ${await quoteContract.balanceOf(signer.address)}`);

    await (await swapRouter.connect(signer).exactOutputSingle({
      tokenIn: quoteContract.address,
      tokenOut: baseContract.address,
      amountInMaximum: 100,
      amountOut: 400,
      deadline: 0,
      fee: 0,
      recipient: signer.address,
      sqrtPriceLimitX96: 0,
    })).wait();
    const quoteBalance = await quoteContract.balanceOf(signer.address);
    const baseBalance = await baseContract.balanceOf(signer.address);

    console.log(`after swap`);
    console.log(`base balance = ${baseBalance}`);
    console.log(`quote balance = ${quoteBalance}`);

    expect(quoteBalance).to.be.equal(0);
    expect(baseBalance).to.be.equal(400);
  });
});
