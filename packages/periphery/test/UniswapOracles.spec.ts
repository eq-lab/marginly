import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { createUniswapV3TickOracle, createUniswapV3TickOracleDouble, Tokens } from './shared/fixtures';
import { BigNumber } from 'ethers';

describe('UniswapV3TickOracle', () => {
  it('getBalancePrice forward', async () => {
    const { oracle, pool } = await loadFixture(createUniswapV3TickOracle);
    const price = await oracle.getBalancePrice(Tokens.USDC, Tokens.WETH);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = sqrtPrice.mul(sqrtPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice forward', async () => {
    const { oracle, pool } = await loadFixture(createUniswapV3TickOracle);
    const price = await oracle.getMargincallPrice(Tokens.USDC, Tokens.WETH);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = sqrtPrice.mul(sqrtPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getBalancePrice backward', async () => {
    const { oracle, pool } = await loadFixture(createUniswapV3TickOracle);
    const price = await oracle.getBalancePrice(Tokens.WETH, Tokens.USDC);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = BigNumber.from(1n << 96n)
      .mul(1n << 96n)
      .div(sqrtPrice.mul(sqrtPrice));
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice backward', async () => {
    const { oracle, pool } = await loadFixture(createUniswapV3TickOracle);
    const price = await oracle.getMargincallPrice(Tokens.WETH, Tokens.USDC);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = BigNumber.from(1n << 96n)
      .mul(1n << 96n)
      .div(sqrtPrice.mul(sqrtPrice));
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });
});

describe.only('UniswapV3TickOracleDouble', () => {
  it('getBalancePrice forward', async () => {
    const { oracle, firstPool, secondPool } = await loadFixture(createUniswapV3TickOracleDouble);
    const price = await oracle.getBalancePrice(Tokens.WETH, Tokens.WBTC);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = secondIntendedPrice.mul(1n << 96n).div(firstIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice forward', async () => {
    const { oracle, firstPool, secondPool } = await loadFixture(createUniswapV3TickOracleDouble);
    const price = await oracle.getMargincallPrice(Tokens.WETH, Tokens.WBTC);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = secondIntendedPrice.mul(1n << 96n).div(firstIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });
});
