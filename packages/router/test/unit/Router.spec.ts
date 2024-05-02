import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { createMarginlyRouter } from '../shared/fixtures';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { constructSwap, Dex, SWAP_ONE } from '../shared/utils';
import { AdapterStorage__factory } from '../../typechain-types';

describe('MarginlyRouter UniswapV3', () => {
  it('swapExactInput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV3 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.UniswapV3], [SWAP_ONE]);
    await marginlyRouter.connect(user).swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, 0);

    expect(await uniswapV3.pool.debugZeroForOne()).to.be.true;
    expect(await uniswapV3.pool.debugExactInput()).to.be.true;

    const price = await uniswapV3.pool.price();

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    expect(await token1.balanceOf(user.address)).to.be.equal(price.mul(amountToSwap));
  });

  it('swapExactInput 0 to 1, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV3 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await uniswapV3.pool.price();
    const amountToGetPlusOne = price.mul(amountToSwap).add(1);

    const swapCalldata = constructSwap([Dex.UniswapV3], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWithCustomError(uniswapV3.adapter, 'InsufficientAmount');
  });

  it('swapExactInput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV3 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.UniswapV3], [SWAP_ONE]);
    await marginlyRouter.connect(user).swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, 0);
    expect(await uniswapV3.pool.debugZeroForOne()).to.be.false;
    expect(await uniswapV3.pool.debugExactInput()).to.be.true;
    const price = await uniswapV3.pool.price();

    expect(await token1.balanceOf(user.address)).to.be.equal(0);
    expect(await token0.balanceOf(user.address)).to.be.equal(BigNumber.from(amountToSwap).div(price));
  });

  it('swapExactInput 1 to 0, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV3 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await uniswapV3.pool.price();
    const amountToGetPlusOne = BigNumber.from(amountToSwap).div(price).add(1);

    const swapCalldata = constructSwap([Dex.UniswapV3], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWithCustomError(uniswapV3.adapter, 'InsufficientAmount');
  });

  it('swapExactOutput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV3 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await uniswapV3.pool.price();

    const amountToGet = 1000;
    const amountTransferred = BigNumber.from(amountToGet).div(price);
    const initialAmount0 = amountTransferred.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.UniswapV3], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token0.address, token1.address, initialAmount0, amountToGet);

    expect(await uniswapV3.pool.debugZeroForOne()).to.be.true;
    expect(await uniswapV3.pool.debugExactInput()).to.be.false;

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0.sub(amountTransferred));
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 0 to 1, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV3 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await uniswapV3.pool.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).div(price);
    const initialAmount0 = amountToSwap.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    const swapCalldata = constructSwap([Dex.UniswapV3], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactOutput(swapCalldata, token0.address, token1.address, amountToSwap.sub(1), amountToGet)
    ).to.be.revertedWithCustomError(uniswapV3.adapter, 'TooMuchRequested');
  });

  it('swapExactOutput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV3 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await uniswapV3.pool.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).mul(price);
    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);
    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.UniswapV3], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token1.address, token0.address, initialAmount1, amountToGet);

    expect(await uniswapV3.pool.debugZeroForOne()).to.be.false;
    expect(await uniswapV3.pool.debugExactInput()).to.be.false;

    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1.sub(amountToSwap));
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 1 to 0, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV3 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await uniswapV3.pool.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).mul(price);
    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);

    const swapCalldata = constructSwap([Dex.UniswapV3], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactOutput(swapCalldata, token1.address, token0.address, amountToSwap.sub(1), amountToGet)
    ).to.be.revertedWithCustomError(uniswapV3.adapter, 'TooMuchRequested');
  });
});

describe('MarginlyRouter UniswapV2', () => {
  it('swapExactInput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.QuickSwap], [SWAP_ONE]);
    await marginlyRouter.connect(user).swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, 0);

    const [reserve0, reserve1] = await uniswapV2.pool.getReserves();
    const amountToSwapWithFee = BigNumber.from(amountToSwap).mul(997);
    const amountToGet = reserve1.mul(amountToSwapWithFee).div(reserve0.mul(1000).add(amountToSwapWithFee));

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactInput 0 to 1, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    const [reserve0, reserve1] = await uniswapV2.pool.getReserves();
    const amountToSwapWithFee = BigNumber.from(amountToSwap).mul(997);
    const amountToGet = reserve1.mul(amountToSwapWithFee).div(reserve0.mul(1000).add(amountToSwapWithFee));

    const swapCalldata = constructSwap([Dex.QuickSwap], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, amountToGet.add(1))
    ).to.be.revertedWithCustomError(uniswapV2.adapter, 'InsufficientAmount');
  });

  it('swapExactInput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.QuickSwap], [SWAP_ONE]);
    await marginlyRouter.connect(user).swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, 0);
    const [reserve0, reserve1] = await uniswapV2.pool.getReserves();
    const amountToSwapWithFee = BigNumber.from(amountToSwap).mul(997);
    const amountToGet = reserve0.mul(amountToSwapWithFee).div(reserve1.mul(1000).add(amountToSwapWithFee));

    expect(await token1.balanceOf(user.address)).to.be.equal(0);
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactInput 1 to 0, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);

    const [reserve0, reserve1] = await uniswapV2.pool.getReserves();
    const amountToSwapWithFee = BigNumber.from(amountToSwap).mul(997);
    const amountToGet = reserve0.mul(amountToSwapWithFee).div(reserve1.mul(1000).add(amountToSwapWithFee));

    const swapCalldata = constructSwap([Dex.QuickSwap], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, amountToGet.add(1))
    ).to.be.revertedWithCustomError(uniswapV2.adapter, 'InsufficientAmount');
  });

  it('swapExactOutput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const [reserve0, reserve1] = await uniswapV2.pool.getReserves();
    const amountToGet = 1000;
    const amountTransferred = reserve0.mul(amountToGet).mul(1000).div(reserve1.sub(amountToGet).mul(997)).add(1);
    const initialAmount0 = amountTransferred.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.QuickSwap], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token0.address, token1.address, initialAmount0, amountToGet);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0.sub(amountTransferred));
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 0 to 1, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const [reserve0, reserve1] = await uniswapV2.pool.getReserves();
    const amountToGet = 1000;
    const amountTransferred = reserve0.mul(amountToGet).mul(1000).div(reserve1.sub(amountToGet).mul(997)).add(1);

    const initialAmount0 = amountTransferred.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    const swapCalldata = constructSwap([Dex.QuickSwap], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactOutput(swapCalldata, token0.address, token1.address, amountTransferred.sub(1), amountToGet)
    ).to.be.revertedWithCustomError(uniswapV2.adapter, 'TooMuchRequested');
  });

  it('swapExactOutput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, uniswapV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const [reserve0, reserve1] = await uniswapV2.pool.getReserves();
    const amountToGet = 1000;
    const amountToSwap = reserve1.mul(amountToGet).mul(1000).div(reserve0.sub(amountToGet).mul(997)).add(1);
    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);
    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.QuickSwap], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token1.address, token0.address, initialAmount1, amountToGet);

    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1.sub(amountToSwap));
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 1 to 0, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, uniswapV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const [reserve0, reserve1] = await uniswapV2.pool.getReserves();
    const amountToGet = 1000;
    const amountToSwap = reserve1.mul(amountToGet).mul(1000).div(reserve0.sub(amountToGet).mul(997)).add(1);

    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);

    const swapCalldata = constructSwap([Dex.QuickSwap], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactOutput(swapCalldata, token1.address, token0.address, amountToSwap.sub(1), amountToGet)
    ).to.be.revertedWithCustomError(uniswapV2.adapter, 'TooMuchRequested');
  });
});

describe('MarginlyRouter Balancer Vault', () => {
  it('swapExactInput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, balancer } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.Balancer], [SWAP_ONE]);
    await marginlyRouter.connect(user).swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, 0);

    const price = await balancer.vault.price();

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    expect(await token1.balanceOf(user.address)).to.be.equal(price.mul(amountToSwap));
  });

  it('swapExactInput 0 to 1, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, balancer } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await balancer.vault.price();
    const amountToGetPlusOne = price.mul(amountToSwap).add(1);

    const swapCalldata = constructSwap([Dex.Balancer], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWith('SWAP_LIMIT');
  });

  it('swapExactInput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, balancer } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.Balancer], [SWAP_ONE]);
    await marginlyRouter.connect(user).swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, 0);
    const price = await balancer.vault.price();

    expect(await token1.balanceOf(user.address)).to.be.equal(0);
    expect(await token0.balanceOf(user.address)).to.be.equal(BigNumber.from(amountToSwap).div(price));
  });

  it('swapExactInput 1 to 0, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, balancer } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await balancer.vault.price();
    const amountToGetPlusOne = BigNumber.from(amountToSwap).div(price).add(1);

    const swapCalldata = constructSwap([Dex.Balancer], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWith('SWAP_LIMIT');
  });

  it('swapExactOutput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, balancer } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await balancer.vault.price();

    const amountToGet = 1000;
    const amountTransferred = BigNumber.from(amountToGet).div(price);
    const initialAmount0 = amountTransferred.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.Balancer], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token0.address, token1.address, initialAmount0, amountToGet);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0.sub(amountTransferred));
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 0 to 1, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, balancer } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await balancer.vault.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).div(price);
    const initialAmount0 = amountToSwap.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    const swapCalldata = constructSwap([Dex.Balancer], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactOutput(swapCalldata, token0.address, token1.address, amountToSwap.sub(1), amountToGet)
    ).to.be.revertedWith('SWAP_LIMIT');
  });

  it('swapExactOutput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, balancer } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await balancer.vault.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).mul(price);
    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);
    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.Balancer], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token1.address, token0.address, initialAmount1, amountToGet);

    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1.sub(amountToSwap));
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 1 to 0, more than maximal amount', async () => {
    const { marginlyRouter, token0, token1, balancer } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await balancer.vault.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).mul(price);
    const initialAmount1 = amountToSwap.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, initialAmount1);

    const swapCalldata = constructSwap([Dex.Balancer], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactOutput(swapCalldata, token1.address, token0.address, amountToSwap.sub(1), amountToGet)
    ).to.be.revertedWith('SWAP_LIMIT');
  });
});

describe('MarginlyRouter WooFi', () => {
  it('swapExactInput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, wooFi } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.Woofi], [SWAP_ONE]);
    await marginlyRouter.connect(user).swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, 0);

    const price0 = (await wooFi.pool.getTokenState(token0.address)).price;
    const price1 = (await wooFi.pool.getTokenState(token1.address)).price;

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    const expectedAmount = price0.mul(amountToSwap).div(price1).sub(2);
    expect(await token1.balanceOf(user.address)).to.be.equal(expectedAmount);
  });

  it('swapExactInput 0 to 1, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, wooFi } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price0 = (await wooFi.pool.getTokenState(token0.address)).price;
    const price1 = (await wooFi.pool.getTokenState(token1.address)).price;
    const amountToGetPlusOne = price0.mul(amountToSwap).div(price1).add(1);

    const swapCalldata = constructSwap([Dex.Woofi], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWith('WooPPV2: base2Amount_LT_minBase2Amount');
  });

  it('swapExactInput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, wooFi } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.Woofi], [SWAP_ONE]);
    await marginlyRouter.connect(user).swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, 0);
    const price0 = (await wooFi.pool.getTokenState(token0.address)).price;
    const price1 = (await wooFi.pool.getTokenState(token1.address)).price;

    expect(await token1.balanceOf(user.address)).to.be.equal(0);
    const expectedAmount = price1.mul(amountToSwap).div(price0).sub(2);
    expect(await token0.balanceOf(user.address)).to.be.equal(expectedAmount);
  });

  it('swapExactInput 1 to 0, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, wooFi } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price0 = (await wooFi.pool.getTokenState(token0.address)).price;
    const price1 = (await wooFi.pool.getTokenState(token1.address)).price;

    const amountToGetPlusOne = price1.mul(amountToSwap).div(price0).add(1);

    const swapCalldata = constructSwap([Dex.Woofi], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWith('WooPPV2: base2Amount_LT_minBase2Amount');
  });

  it('swapExactOutput 0 to 1', async () => {
    const { marginlyRouter, token0, token1, wooFi } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price0 = (await wooFi.pool.getTokenState(token0.address)).price;
    const price1 = (await wooFi.pool.getTokenState(token1.address)).price;

    const amountToGet = 1000;
    const amountTransferred = price1.mul(amountToGet).div(price0).mul(105).div(100);
    const initialAmount0 = amountTransferred.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.Woofi], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token0.address, token1.address, amountTransferred, amountToGet);

    expect(await token0.balanceOf(user.address)).to.be.lt(initialAmount0);
    expect(await token0.balanceOf(user.address)).to.be.gt(initialAmount0.sub(amountTransferred));
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 1 to 0', async () => {
    const { marginlyRouter, token0, token1, wooFi } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price0 = (await wooFi.pool.getTokenState(token0.address)).price;
    const price1 = (await wooFi.pool.getTokenState(token1.address)).price;

    const amountToGet = 1000;
    const amountTransferred = price0.mul(amountToGet).div(price1).mul(105).div(100);
    const initialAmount1 = amountTransferred.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, amountTransferred);

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1);

    const swapCalldata = constructSwap([Dex.Woofi], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token1.address, token0.address, amountTransferred, amountToGet);

    expect(await token0.balanceOf(user.address)).to.be.equal(amountToGet);
    expect(await token1.balanceOf(user.address)).to.be.lt(initialAmount1);
    expect(await token1.balanceOf(user.address)).to.be.gt(initialAmount1.sub(amountTransferred));
  });
});

describe('MarginlyRouter DodoV1', () => {
  it('swapExactInput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, dodoV1 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.DodoV1], [SWAP_ONE]);
    await marginlyRouter.connect(user).swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, 0);

    const price = await dodoV1.pool._BASE_TO_QUOTE_PRICE_();

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    const expectedAmount = price.mul(amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(expectedAmount);
  });

  it('swapExactInput 0 to 1, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, dodoV1 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await dodoV1.pool._BASE_TO_QUOTE_PRICE_();
    const amountToGetPlusOne = price.mul(amountToSwap).add(1);

    const swapCalldata = constructSwap([Dex.DodoV1], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWith('SELL_BASE_RECEIVE_NOT_ENOUGH');
  });

  it('swapExactInput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, dodoV1 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await dodoV1.pool._BASE_TO_QUOTE_PRICE_();
    const amountToSwap = 1000;
    const minAmountOut = BigNumber.from(amountToSwap).mul(9).div(10).div(price);

    const token0BalanceBefore = await token0.balanceOf(dodoV1.pool.address);
    const token1BalanceBefore = await token0.balanceOf(dodoV1.pool.address);

    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToSwap);

    const swapCalldata = constructSwap([Dex.DodoV1], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, minAmountOut);

    expect(await token1.balanceOf(user.address)).to.be.equal(0);
    const expectedAmount = BigNumber.from(amountToSwap).div(price);
    expect(await token0.balanceOf(user.address)).to.be.equal(expectedAmount);

    expect(await token0.balanceOf(dodoV1.pool.address)).to.be.not.equal(token0BalanceBefore);
    expect(await token1.balanceOf(dodoV1.pool.address)).to.be.not.equal(token1BalanceBefore);
  });

  it('swapExactInput 1 to 0, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, dodoV1 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await dodoV1.pool._BASE_TO_QUOTE_PRICE_();
    const amountToGetPlusOne = BigNumber.from(amountToSwap).div(price).add(1);

    const swapCalldata = constructSwap([Dex.DodoV1], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWith('BUY_BASE_COST_TOO_MUCH');
  });

  it('swapExactOutput 0 to 1', async () => {
    const { marginlyRouter, token0, token1, dodoV1 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await dodoV1.pool._BASE_TO_QUOTE_PRICE_();

    const amountToGet = 1000;
    const amountTransferred = BigNumber.from(amountToGet).div(price).mul(105).div(100);
    const initialAmount0 = amountTransferred.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.DodoV1], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token0.address, token1.address, amountTransferred, amountToGet);

    expect(await token0.balanceOf(user.address)).to.be.lt(initialAmount0);
    expect(await token0.balanceOf(user.address)).to.be.gt(initialAmount0.sub(amountTransferred));
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 1 to 0', async () => {
    const { marginlyRouter, token0, token1, dodoV1 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await dodoV1.pool._BASE_TO_QUOTE_PRICE_();

    const amountToGet = 1000;
    const amountTransferred = price.mul(amountToGet).mul(105).div(100);
    const initialAmount1 = amountTransferred.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, amountTransferred);

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1);

    const swapCalldata = constructSwap([Dex.DodoV1], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token1.address, token0.address, amountTransferred, amountToGet);

    expect(await token0.balanceOf(user.address)).to.be.equal(amountToGet);
    expect(await token1.balanceOf(user.address)).to.be.lt(initialAmount1);
    expect(await token1.balanceOf(user.address)).to.be.gt(initialAmount1.sub(amountTransferred));
  });
});

describe('MarginlyRouter DodoV2', () => {
  it('swapExactInput 0 to 1, success', async () => {
    const { marginlyRouter, token0, token1, dodoV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.DodoV2], [SWAP_ONE]);
    await marginlyRouter.connect(user).swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, 0);

    const price = await dodoV2.pool._BASE_TO_QUOTE_PRICE_();

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    const expectedAmount = price.mul(amountToSwap);
    expect(await token1.balanceOf(user.address)).to.be.equal(expectedAmount);
  });

  it('swapExactInput 0 to 1, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, dodoV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await dodoV2.pool._BASE_TO_QUOTE_PRICE_();
    const amountToGetPlusOne = price.mul(amountToSwap).add(1);

    const swapCalldata = constructSwap([Dex.DodoV2], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token0.address, token1.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWithCustomError(dodoV2.adapter, 'InsufficientAmount');
  });

  it('swapExactInput 1 to 0, success', async () => {
    const { marginlyRouter, token0, token1, dodoV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToSwap);

    const swapCalldata = constructSwap([Dex.DodoV2], [SWAP_ONE]);
    await marginlyRouter.connect(user).swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, 0);

    const price = await dodoV2.pool._BASE_TO_QUOTE_PRICE_();

    expect(await token1.balanceOf(user.address)).to.be.equal(0);
    const expectedAmount = BigNumber.from(amountToSwap).div(price);
    expect(await token0.balanceOf(user.address)).to.be.equal(expectedAmount);
  });

  it('swapExactInput 1 to 0, less than minimal amount', async () => {
    const { marginlyRouter, token0, token1, dodoV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token1.mint(user.address, amountToSwap);
    await token1.connect(user).approve(marginlyRouter.address, amountToSwap);

    const price = await dodoV2.pool._BASE_TO_QUOTE_PRICE_();
    const amountToGetPlusOne = BigNumber.from(amountToSwap).div(price).add(1);

    const swapCalldata = constructSwap([Dex.DodoV2], [SWAP_ONE]);
    await expect(
      marginlyRouter
        .connect(user)
        .swapExactInput(swapCalldata, token1.address, token0.address, amountToSwap, amountToGetPlusOne)
    ).to.be.revertedWithCustomError(dodoV2.adapter, 'InsufficientAmount');
  });

  it('swapExactOutput 0 to 1', async () => {
    const { marginlyRouter, token0, token1, dodoV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await dodoV2.pool._BASE_TO_QUOTE_PRICE_();

    const amountToGet = 1000;
    const amountTransferred = BigNumber.from(amountToGet).div(price).mul(105).div(100);
    const initialAmount0 = amountTransferred.mul(100);
    await token0.mint(user.address, initialAmount0);
    await token0.connect(user).approve(marginlyRouter.address, initialAmount0);

    expect(await token0.balanceOf(user.address)).to.be.equal(initialAmount0);
    expect(await token1.balanceOf(user.address)).to.be.equal(0);

    const swapCalldata = constructSwap([Dex.DodoV2], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token0.address, token1.address, amountTransferred, amountToGet);

    expect(await token0.balanceOf(user.address)).to.be.lt(initialAmount0);
    expect(await token0.balanceOf(user.address)).to.be.gt(initialAmount0.sub(amountTransferred));
    expect(await token1.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput 1 to 0', async () => {
    const { marginlyRouter, token0, token1, dodoV2 } = await loadFixture(createMarginlyRouter);
    const [_, user] = await ethers.getSigners();

    const price = await dodoV2.pool._BASE_TO_QUOTE_PRICE_();

    const amountToGet = 1000;
    const amountTransferred = price.mul(amountToGet).mul(105).div(100);
    const initialAmount1 = amountTransferred.mul(100);
    await token1.mint(user.address, initialAmount1);
    await token1.connect(user).approve(marginlyRouter.address, amountTransferred);

    expect(await token0.balanceOf(user.address)).to.be.equal(0);
    expect(await token1.balanceOf(user.address)).to.be.equal(initialAmount1);

    const swapCalldata = constructSwap([Dex.DodoV2], [SWAP_ONE]);
    await marginlyRouter
      .connect(user)
      .swapExactOutput(swapCalldata, token1.address, token0.address, amountTransferred, amountToGet);

    expect(await token0.balanceOf(user.address)).to.be.equal(amountToGet);
    expect(await token1.balanceOf(user.address)).to.be.lt(initialAmount1);
    expect(await token1.balanceOf(user.address)).to.be.gt(initialAmount1.sub(amountTransferred));
  });
});

describe('Callbacks', () => {
  it('adapter callback fails if sender is unknown', async () => {
    const { marginlyRouter, token0 } = await loadFixture(createMarginlyRouter);
    const [_, user, fraud] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    const encodedData = ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'uint256'],
      [user.address, token0.address, `0`]
    );

    await expect(
      marginlyRouter.connect(fraud).adapterCallback(fraud.address, amountToSwap, encodedData)
    ).to.be.revertedWithoutReason();
  });

  it('uniswapV3 callback fails if sender is unknown', async () => {
    const { marginlyRouter, token0, token1, uniswapV3 } = await loadFixture(createMarginlyRouter);
    const [_, user, fraud] = await ethers.getSigners();

    const amountToSwap = 1000;
    await token0.mint(user.address, amountToSwap);
    await token0.connect(user).approve(marginlyRouter.address, amountToSwap);

    const encodedData = ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'address', 'address', 'address', 'uint256'],
      [token0.address, token1.address, marginlyRouter.address, user.address, token0.address, `0`]
    );

    await expect(
      // @ts-ignore
      uniswapV3.adapter.connect(fraud).uniswapV3SwapCallback(amountToSwap, 0, encodedData)
    ).to.be.revertedWithoutReason();
  });

  it('should raise error when trying to renounce ownership from router', async () => {
    const { marginlyRouter } = await loadFixture(createMarginlyRouter);
    await expect(marginlyRouter.renounceOwnership()).to.be.revertedWithCustomError(marginlyRouter, 'Forbidden');
  });

  it('should raise error when trying to renounce ownership from adapter', async () => {
    const { marginlyRouter } = await loadFixture(createMarginlyRouter);
    const [owner] = await ethers.getSigners();
    const adapterAddress = await marginlyRouter.adapters(0);
    const adapterStorage = AdapterStorage__factory.connect(adapterAddress, owner);
    await expect(adapterStorage.renounceOwnership()).to.be.revertedWithCustomError(adapterStorage, 'Forbidden');
  });
});
