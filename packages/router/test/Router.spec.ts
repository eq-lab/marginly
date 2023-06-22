import { expect } from 'chai';
import { createMarginlyRouter } from './shared/fixtures';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';



describe('MarginlyRouter Uniswap', () => {
  it('swapExactInput quote to base', async () => {
    const { marginlyRouter, quoteToken, baseToken, uniswapPool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await quoteToken.mint(user.address, amountToSwap);
    await quoteToken.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await quoteToken.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await baseToken.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactInput(0, quoteToken.address, baseToken.address, amountToSwap, 0);

    const price = await uniswapPool.price();

    expect(await quoteToken.balanceOf(user.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(user.address)).to.be.equal(price.mul(amountToSwap));
  });

  it('swapExactInput base to quote', async () => {
    const { marginlyRouter, quoteToken, baseToken, uniswapPool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 1000;
    await baseToken.mint(user.address, amountToSwap);
    await baseToken.connect(user).approve(marginlyRouter.address, amountToSwap);
    expect(await baseToken.balanceOf(user.address)).to.be.equal(amountToSwap);
    expect(await quoteToken.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactInput(0, baseToken.address, quoteToken.address, amountToSwap, 0);

    const price = await uniswapPool.price();

    expect(await baseToken.balanceOf(user.address)).to.be.equal(0);
    expect(await quoteToken.balanceOf(user.address)).to.be.equal(BigNumber.from(amountToSwap).div(price));
  });

  it('swapExactOutput quote to base', async () => {
    const { marginlyRouter, quoteToken, baseToken, uniswapPool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await uniswapPool.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).div(price);
    const initialQuoteAmount = amountToSwap.mul(100);
    await quoteToken.mint(user.address, initialQuoteAmount);
    await quoteToken.connect(user).approve(marginlyRouter.address, initialQuoteAmount);
    expect(await quoteToken.balanceOf(user.address)).to.be.equal(initialQuoteAmount);
    expect(await baseToken.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactOutput(
      0, quoteToken.address, baseToken.address, initialQuoteAmount, amountToGet
    );

    expect(await quoteToken.balanceOf(user.address)).to.be.equal(initialQuoteAmount.sub(amountToSwap));
    expect(await baseToken.balanceOf(user.address)).to.be.equal(amountToGet);
  });

  it('swapExactOutput base to quote', async () => {
    const { marginlyRouter, quoteToken, baseToken, uniswapPool } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const price = await uniswapPool.price();

    const amountToGet = 1000;
    const amountToSwap = BigNumber.from(amountToGet).mul(price);
    const initialBaseAmount = amountToSwap.mul(100);
    await baseToken.mint(user.address, initialBaseAmount);
    await baseToken.connect(user).approve(marginlyRouter.address, initialBaseAmount);
    expect(await baseToken.balanceOf(user.address)).to.be.equal(initialBaseAmount);
    expect(await quoteToken.balanceOf(user.address)).to.be.equal(0);

    await marginlyRouter.connect(user).swapExactOutput(
      0, baseToken.address, quoteToken.address, initialBaseAmount, amountToGet
    );

    expect(await baseToken.balanceOf(user.address)).to.be.equal(initialBaseAmount.sub(amountToSwap));
    expect(await quoteToken.balanceOf(user.address)).to.be.equal(amountToGet);
  });
});

describe('MarginlyRouter UnknownDex', () => {
  it('swapExactInput UnknownDex', async () => {
    const { marginlyRouter, quoteToken, baseToken } = await createMarginlyRouter();
    const [_, user] = await ethers.getSigners();

    const amountToSwap = 10;
    await quoteToken.mint(user.address, amountToSwap);
    await quoteToken.connect(user).approve(marginlyRouter.address, amountToSwap);
    
    expect(
      marginlyRouter.connect(user).swapExactInput(255, quoteToken.address, baseToken.address, amountToSwap, 0)
    ).to.be.revertedWithCustomError(marginlyRouter, 'UnknownDex');
  });
});
