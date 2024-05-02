import { ethers } from 'hardhat';
import { MarginlyRouter, TestERC20Token, TestStableSwap2EMAOraclePool } from '../../typechain-types';
import { BigNumber } from 'ethers';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { createCurveAdapter, createCurveAdapterInverse } from '../shared/fixtures';
import { constructSwap, Dex, SWAP_ONE } from '../shared/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const ONE = BigNumber.from(10).pow(18);

async function swapExactInput(
  pool: TestStableSwap2EMAOraclePool,
  router: MarginlyRouter,
  signer: SignerWithAddress,
  price: BigNumber,
  token0: TestERC20Token,
  token1: TestERC20Token,
  amountIn: BigNumber,
  minAmountOut: BigNumber,
  zeroToOne: boolean
) {
  await pool.setPrice(price);
  if (zeroToOne) {
    await token0.approve(router.address, amountIn);
  } else {
    await token1.approve(router.address, amountIn);
  }

  const swapCalldata = constructSwap([Dex.Curve], [SWAP_ONE]);
  await router.swapExactInput(
    swapCalldata,
    zeroToOne ? token0.address : token1.address,
    zeroToOne ? token1.address : token0.address,
    amountIn,
    minAmountOut
  );
}

async function swapExactOutput(
  pool: TestStableSwap2EMAOraclePool,
  router: MarginlyRouter,
  signer: SignerWithAddress,
  price: BigNumber,
  token0: TestERC20Token,
  token1: TestERC20Token,
  maxAmountIn: BigNumber,
  amountOut: BigNumber,
  zeroToOne: boolean
) {
  await pool.setPrice(price);
  if (zeroToOne) {
    await token0.approve(router.address, maxAmountIn);
  } else {
    await token1.approve(router.address, maxAmountIn);
  }

  const swapCalldata = constructSwap([Dex.Curve], [SWAP_ONE]);
  await router.swapExactOutput(
    swapCalldata,
    zeroToOne ? token0.address : token1.address,
    zeroToOne ? token1.address : token0.address,
    maxAmountIn,
    amountOut
  );
}

describe('Curve adapter', () => {
  it('swapExactInput token0 to token1', async () => {
    const [owner] = await ethers.getSigners();
    const { router, pool, token0, token1 } = await loadFixture(createCurveAdapter);

    // 1.0 TK1 = 2.0 TK0
    const price = BigNumber.from(10).pow(18).mul(2);
    const amountIn = BigNumber.from(10).pow(17); // 0.1 TK0
    const minAmountOut = amountIn.mul(ONE).div(price); // 0.05 TK1

    const token0BalanceBefore = await token0.balanceOf(owner.address);
    const token1BalanceBefore = await token1.balanceOf(owner.address);

    await swapExactInput(pool, router, owner, price, token0, token1, amountIn, minAmountOut, true);

    const token0BalanceAfter = await token0.balanceOf(owner.address);
    const token1BalanceAfter = await token1.balanceOf(owner.address);

    expect(token0BalanceAfter).to.be.equal(token0BalanceBefore.sub(amountIn));
    expect(token1BalanceAfter).to.be.equal(token1BalanceBefore.add(minAmountOut));
  });

  it('swapExactInput token1 to token0', async () => {
    const [owner] = await ethers.getSigners();
    const { router, pool, token0, token1 } = await loadFixture(createCurveAdapter);

    // 1.0 TK1 = 2.0 TK0
    const price = BigNumber.from(10).pow(18).mul(2);
    const amountIn = BigNumber.from(10).pow(17); // 0.1 TK1
    const minAmountOut = amountIn.mul(price).div(ONE); // 0.2 TK0

    const token0BalanceBefore = await token0.balanceOf(owner.address);
    const token1BalanceBefore = await token1.balanceOf(owner.address);

    await swapExactInput(pool, router, owner, price, token0, token1, amountIn, minAmountOut, false);

    const token0BalanceAfter = await token0.balanceOf(owner.address);
    const token1BalanceAfter = await token1.balanceOf(owner.address);

    expect(token1BalanceAfter).to.be.equal(token1BalanceBefore.sub(amountIn));
    expect(token0BalanceAfter).to.be.equal(token0BalanceBefore.add(minAmountOut));
  });

  it('swapExactOutput token0 to token1', async () => {
    const [owner] = await ethers.getSigners();
    const { router, pool, token0, token1 } = await loadFixture(createCurveAdapter);

    // 1.0 TK1 = 2.0 TK0
    const price = BigNumber.from(10).pow(18).mul(2);
    const amountOut = BigNumber.from(10).pow(17); // 0.1 TK1
    const maxAmountIn = amountOut.mul(price).div(ONE); // 0.05 TK1

    const token0BalanceBefore = await token0.balanceOf(owner.address);
    const token1BalanceBefore = await token1.balanceOf(owner.address);

    await swapExactOutput(pool, router, owner, price, token0, token1, maxAmountIn, amountOut, true);

    const token0BalanceAfter = await token0.balanceOf(owner.address);
    const token1BalanceAfter = await token1.balanceOf(owner.address);

    expect(token0BalanceAfter).to.be.equal(token0BalanceBefore.sub(maxAmountIn));
    expect(token1BalanceAfter).to.be.equal(token1BalanceBefore.add(amountOut));
  });

  it('swapExactOutput token1 to token0', async () => {
    const [owner] = await ethers.getSigners();
    const { router, pool, token0, token1 } = await loadFixture(createCurveAdapter);

    // 1.0 TK1 = 2.0 TK0
    const price = BigNumber.from(10).pow(18).mul(2);
    const amountOut = BigNumber.from(10).pow(17); // 0.1 TK0
    const maxAmountIn = amountOut.mul(ONE).div(price); // 0.2 TK1

    const token0BalanceBefore = await token0.balanceOf(owner.address);
    const token1BalanceBefore = await token1.balanceOf(owner.address);

    await swapExactOutput(pool, router, owner, price, token0, token1, maxAmountIn, amountOut, false);

    const token0BalanceAfter = await token0.balanceOf(owner.address);
    const token1BalanceAfter = await token1.balanceOf(owner.address);

    expect(token1BalanceAfter).to.be.equal(token1BalanceBefore.sub(maxAmountIn));
    expect(token0BalanceAfter).to.be.equal(token0BalanceBefore.add(amountOut));
  });

  it('inverse: swapExactInput token0 to token1', async () => {
    const [owner] = await ethers.getSigners();
    const { router, pool, token0, token1 } = await loadFixture(createCurveAdapterInverse);

    // 1.0 TK1 = 2.0 TK0
    const price = BigNumber.from(10).pow(18).mul(2);
    const amountIn = BigNumber.from(10).pow(17); // 0.1 TK0
    const minAmountOut = amountIn.mul(ONE).div(price); // 0.05 TK1

    const token0BalanceBefore = await token0.balanceOf(owner.address);
    const token1BalanceBefore = await token1.balanceOf(owner.address);

    await swapExactInput(pool, router, owner, price, token0, token1, amountIn, minAmountOut, true);

    const token0BalanceAfter = await token0.balanceOf(owner.address);
    const token1BalanceAfter = await token1.balanceOf(owner.address);

    expect(token0BalanceAfter).to.be.equal(token0BalanceBefore.sub(amountIn));
    expect(token1BalanceAfter).to.be.equal(token1BalanceBefore.add(minAmountOut));
  });

  it('inverse: swapExactInput token1 to token0', async () => {
    const [owner] = await ethers.getSigners();
    const { router, pool, token0, token1 } = await loadFixture(createCurveAdapterInverse);

    // 1.0 TK1 = 2.0 TK0
    const price = BigNumber.from(10).pow(18).mul(2);
    const amountIn = BigNumber.from(10).pow(17); // 0.1 TK1
    const minAmountOut = amountIn.mul(price).div(ONE); // 0.2 TK0

    const token0BalanceBefore = await token0.balanceOf(owner.address);
    const token1BalanceBefore = await token1.balanceOf(owner.address);

    await swapExactInput(pool, router, owner, price, token0, token1, amountIn, minAmountOut, false);

    const token0BalanceAfter = await token0.balanceOf(owner.address);
    const token1BalanceAfter = await token1.balanceOf(owner.address);

    expect(token1BalanceAfter).to.be.equal(token1BalanceBefore.sub(amountIn));
    expect(token0BalanceAfter).to.be.equal(token0BalanceBefore.add(minAmountOut));
  });

  it('inverse: swapExactOutput token0 to token1', async () => {
    const [owner] = await ethers.getSigners();
    const { router, pool, token0, token1 } = await loadFixture(createCurveAdapterInverse);

    // 1.0 TK1 = 2.0 TK0
    const price = BigNumber.from(10).pow(18).mul(2);
    const amountOut = BigNumber.from(10).pow(17); // 0.1 TK1
    const maxAmountIn = amountOut.mul(price).div(ONE); // 0.05 TK1

    const token0BalanceBefore = await token0.balanceOf(owner.address);
    const token1BalanceBefore = await token1.balanceOf(owner.address);

    await swapExactOutput(pool, router, owner, price, token0, token1, maxAmountIn, amountOut, true);

    const token0BalanceAfter = await token0.balanceOf(owner.address);
    const token1BalanceAfter = await token1.balanceOf(owner.address);

    expect(token0BalanceAfter).to.be.equal(token0BalanceBefore.sub(maxAmountIn));
    expect(token1BalanceAfter).to.be.equal(token1BalanceBefore.add(amountOut));
  });

  it('inverse: swapExactOutput token1 to token0', async () => {
    const [owner] = await ethers.getSigners();
    const { router, pool, token0, token1 } = await loadFixture(createCurveAdapterInverse);

    // 1.0 TK1 = 2.0 TK0
    const price = BigNumber.from(10).pow(18).mul(2);
    const amountOut = BigNumber.from(10).pow(17); // 0.1 TK0
    const maxAmountIn = amountOut.mul(ONE).div(price); // 0.2 TK1

    const token0BalanceBefore = await token0.balanceOf(owner.address);
    const token1BalanceBefore = await token1.balanceOf(owner.address);

    await swapExactOutput(pool, router, owner, price, token0, token1, maxAmountIn, amountOut, false);

    const token0BalanceAfter = await token0.balanceOf(owner.address);
    const token1BalanceAfter = await token1.balanceOf(owner.address);

    expect(token1BalanceAfter).to.be.equal(token1BalanceBefore.sub(maxAmountIn));
    expect(token0BalanceAfter).to.be.equal(token0BalanceBefore.add(amountOut));
  });
});
