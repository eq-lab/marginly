import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  createAlgebraTickOracleBackward,
  createAlgebraTickOracleDoubleBIQ,
  createAlgebraTickOracleDoubleBQI,
  createAlgebraTickOracleDoubleIBQ,
  createAlgebraTickOracleDoubleIQB,
  createAlgebraTickOracleDoubleQBI,
  createAlgebraTickOracleDoubleQIB,
  createAlgebraTickOracleForward,
} from './shared/fixtures';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

describe('AlgebraTickOracle prices', () => {
  it('getBalancePrice forward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleForward);
    const price = await oracle.getBalancePrice(quoteToken, baseToken);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = sqrtPrice.mul(sqrtPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice forward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleForward);
    const price = await oracle.getMargincallPrice(quoteToken, baseToken);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = sqrtPrice.mul(sqrtPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getBalancePrice backward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleBackward);
    const price = await oracle.getBalancePrice(quoteToken, baseToken);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = BigNumber.from(1n << 96n)
      .mul(1n << 96n)
      .div(sqrtPrice.mul(sqrtPrice));
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice backward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleBackward);
    const price = await oracle.getMargincallPrice(quoteToken, baseToken);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = BigNumber.from(1n << 96n)
      .mul(1n << 96n)
      .div(sqrtPrice.mul(sqrtPrice));
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });
});

describe('AlgebraTickOracle tech methods', () => {
  it('set new params', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleForward);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    const secAgo = 1000;
    expect(secAgo).to.be.not.eq(oldParams.secondsAgo);
    const secAgoLiq = 6;
    expect(secAgoLiq).to.be.not.eq(oldParams.secondsAgoLiquidation);

    await oracle.setOptions(quoteToken, baseToken, secAgo, secAgoLiq);

    const newParams = await oracle.getParams(quoteToken, baseToken);

    expect(newParams.initialized).to.be.true;
    expect(newParams.secondsAgo).to.be.eq(secAgo);
    expect(newParams.secondsAgoLiquidation).to.be.eq(secAgoLiq);
  });

  it('set new params, not owner', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleForward);

    const notOwner = (await ethers.getSigners())[1];

    await expect(oracle.connect(notOwner).setOptions(quoteToken, baseToken, 1000, 6)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('set new params, zero secondsAgo', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleForward);
    await expect(oracle.setOptions(quoteToken, baseToken, 0, 5)).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('set new params, zero secondsAgoLiquidation', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleForward);
    await expect(oracle.setOptions(quoteToken, baseToken, 900, 0)).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('oracle initialization, no uniswap Pool', async () => {
    const { oracle, algebraFactory } = await loadFixture(createAlgebraTickOracleForward);

    const quoteToken = '0x0000000000000000000000000000000000000bad';
    const baseToken = '0x000000000000000000000000000000000000dead';
    expect(await algebraFactory.poolByPair(quoteToken, baseToken)).to.be.eq(
      '0x0000000000000000000000000000000000000000'
    );

    await expect(oracle.setOptions(quoteToken, baseToken, 900, 5)).to.be.revertedWithCustomError(oracle, 'UnknownPool');
  });

  it('oracle initialization should fail when secondsAgoLiquidation > secondsAgo', async () => {
    const { oracle, baseToken, quoteToken } = await loadFixture(createAlgebraTickOracleForward);

    await expect(oracle.setOptions(quoteToken, baseToken, 5, 900)).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });
});

describe('AlgebraTickOracleDouble prices', () => {
  it('getBalancePrice IBQ', async () => {
    const { oracle, firstPool, secondPool, quoteToken, baseToken } = await loadFixture(
      createAlgebraTickOracleDoubleIBQ
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
      createAlgebraTickOracleDoubleIBQ
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
      createAlgebraTickOracleDoubleIQB
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
      createAlgebraTickOracleDoubleIQB
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
      createAlgebraTickOracleDoubleBQI
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
      createAlgebraTickOracleDoubleBQI
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
      createAlgebraTickOracleDoubleBIQ
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
      createAlgebraTickOracleDoubleBIQ
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
      createAlgebraTickOracleDoubleQIB
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
      createAlgebraTickOracleDoubleQIB
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
      createAlgebraTickOracleDoubleQBI
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
      createAlgebraTickOracleDoubleQBI
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

describe('AlgebraTickOracleDouble tech methods', () => {
  it('set new params', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleDoubleIBQ);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    const secAgo = 1000;
    expect(secAgo).to.be.not.eq(oldParams.secondsAgo);
    const secAgoLiq = 6;
    expect(secAgoLiq).to.be.not.eq(oldParams.secondsAgoLiquidation);

    await oracle.setOptions(quoteToken, baseToken, secAgo, secAgoLiq, oldParams.intermediateToken);

    const newParams = await oracle.getParams(quoteToken, baseToken);

    expect(newParams.initialized).to.be.true;
    expect(newParams.secondsAgo).to.be.eq(secAgo);
    expect(newParams.secondsAgoLiquidation).to.be.eq(secAgoLiq);
  });

  it('set new params, not owner', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleDoubleIBQ);

    const notOwner = (await ethers.getSigners())[1];

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    await expect(
      oracle.connect(notOwner).setOptions(quoteToken, baseToken, 1000, 6, oldParams.intermediateToken)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('set new params, wrong intermediate token', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleDoubleIBQ);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    const intermediateToken = '0x000000000000000000000000000000000000dead';
    expect(intermediateToken).to.be.not.eq(oldParams.intermediateToken);

    await expect(oracle.setOptions(quoteToken, baseToken, 900, 5, intermediateToken)).to.be.revertedWithCustomError(
      oracle,
      'CannotChangeUnderlyingPool'
    );
  });

  it('set new params, zero secondsAgo', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleDoubleIBQ);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    await expect(
      oracle.setOptions(quoteToken, baseToken, 0, 5, oldParams.intermediateToken)
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('set new params, zero secondsAgoLiquidation', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createAlgebraTickOracleDoubleIBQ);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    await expect(
      oracle.setOptions(quoteToken, baseToken, 900, 0, oldParams.intermediateToken)
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('oracle initialization, no base uniswap pool', async () => {
    const { oracle, algebraFactory, baseToken, quoteToken, intermediateToken } = await loadFixture(
      createAlgebraTickOracleDoubleIBQ
    );

    const fee = 300;
    const otherBaseToken = '0x0000000000000000000000000000000000000bad';
    expect(await algebraFactory.poolByPair(intermediateToken, otherBaseToken)).to.be.eq(
      '0x0000000000000000000000000000000000000000'
    );

    await expect(
      oracle.setOptions(quoteToken, otherBaseToken, 900, 5, intermediateToken)
    ).to.be.revertedWithCustomError(oracle, 'UnknownPool');
  });

  it('oracle initialization, no quote uniswap pool', async () => {
    const { oracle, algebraFactory, baseToken, quoteToken, intermediateToken } = await loadFixture(
      createAlgebraTickOracleDoubleIBQ
    );

    const fee = 300;
    const otherQuoteToken = '0x0000000000000000000000000000000000000bad';
    expect(await algebraFactory.poolByPair(intermediateToken, otherQuoteToken)).to.be.eq(
      '0x0000000000000000000000000000000000000000'
    );

    await expect(
      oracle.setOptions(otherQuoteToken, baseToken, 900, 5, intermediateToken)
    ).to.be.revertedWithCustomError(oracle, 'UnknownPool');
  });

  it('oracle initialization should fail when secondsAgoLiquidation > secondsAgo', async () => {
    const { oracle, algebraFactory, baseToken, quoteToken, intermediateToken } = await loadFixture(
      createAlgebraTickOracleDoubleIBQ
    );

    await expect(oracle.setOptions(quoteToken, baseToken, 5, 900, intermediateToken)).to.be.revertedWithCustomError(
      oracle,
      'WrongValue'
    );
  });
});
