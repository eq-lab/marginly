import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  createUniswapV3TickOracleBackward,
  createUniswapV3TickOracleDoubleBIQ,
  createUniswapV3TickOracleDoubleBQI,
  createUniswapV3TickOracleDoubleIBQ,
  createUniswapV3TickOracleDoubleIQB,
  createUniswapV3TickOracleDoubleQBI,
  createUniswapV3TickOracleDoubleQIB,
  createUniswapV3TickOracleForward,
} from './shared/fixtures';
import { BigNumber } from 'ethers';

describe('UniswapV3TickOracle', () => {
  it('getBalancePrice forward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleForward);
    const price = await oracle.getBalancePrice(quoteToken, baseToken);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = sqrtPrice.mul(sqrtPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice forward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleForward);
    const price = await oracle.getMargincallPrice(quoteToken, baseToken);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = sqrtPrice.mul(sqrtPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getBalancePrice backward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleBackward);
    const price = await oracle.getBalancePrice(quoteToken, baseToken);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = BigNumber.from(1n << 96n)
      .mul(1n << 96n)
      .div(sqrtPrice.mul(sqrtPrice));
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice backward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleBackward);
    const price = await oracle.getMargincallPrice(quoteToken, baseToken);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = BigNumber.from(1n << 96n)
      .mul(1n << 96n)
      .div(sqrtPrice.mul(sqrtPrice));
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });
});

describe.only('UniswapV3TickOracleDouble', () => {
  it('getBalancePrice IBQ', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleIBQ
    );
    const price = await oracle.getBalancePrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = secondIntendedPrice.mul(1n << 96n).div(firstIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice IBQ', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleIBQ
    );
    const price = await oracle.getMargincallPrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = secondIntendedPrice.mul(1n << 96n).div(firstIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getBalancePrice IQB', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleIQB
    );
    const price = await oracle.getBalancePrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = secondIntendedPrice.mul(1n << 96n).div(firstIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice IQB', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleIQB
    );
    const price = await oracle.getMargincallPrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = secondIntendedPrice.mul(1n << 96n).div(firstIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getBalancePrice BQI', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleBQI
    );
    const price = await oracle.getBalancePrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = firstIntendedPrice.mul(1n << 96n).div(secondIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice BQI', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleBQI
    );
    const price = await oracle.getMargincallPrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = firstIntendedPrice.mul(1n << 96n).div(secondIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getBalancePrice BIQ', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleBIQ
    );
    const price = await oracle.getBalancePrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const one = BigNumber.from(1n << 96n);
    const intendedPrice = one.mul(one).mul(one).div(firstIntendedPrice).div(secondIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice BIQ', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleBIQ
    );
    const price = await oracle.getMargincallPrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const one = BigNumber.from(1n << 96n);
    const intendedPrice = one.mul(one).mul(one).div(firstIntendedPrice).div(secondIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getBalancePrice QIB', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleQIB
    );
    const price = await oracle.getBalancePrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = secondIntendedPrice.mul(firstIntendedPrice).div(1n << 96n);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice QIB', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleQIB
    );
    const price = await oracle.getMargincallPrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = secondIntendedPrice.mul(firstIntendedPrice).div(1n << 96n);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getBalancePrice QBI', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleQBI
    );
    const price = await oracle.getBalancePrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = firstIntendedPrice.mul(1n << 96n).div(secondIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice QBI', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createUniswapV3TickOracleDoubleQBI
    );
    const price = await oracle.getMargincallPrice(quoteToken, baseToken);

    const firstSqrtPrice = await firstPool.token1ToToken0SqrtPriceX96();
    const firstIntendedPrice = firstSqrtPrice.mul(firstSqrtPrice);

    const secondSqrtPrice = await secondPool.token1ToToken0SqrtPriceX96();
    const secondIntendedPrice = secondSqrtPrice.mul(secondSqrtPrice);

    const intendedPrice = firstIntendedPrice.mul(1n << 96n).div(secondIntendedPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });
});
