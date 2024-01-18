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
import { ethers } from 'hardhat';

describe('UniswapV3TickOracle prices', () => {
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

describe('UniswapV3TickOracle tech methods', () => {
  it('set new params', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleForward);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    const secAgo = 1000;
    expect(secAgo).to.be.not.eq(oldParams.secondsAgo);
    const secAgoLiq = 6;
    expect(secAgoLiq).to.be.not.eq(oldParams.secondsAgoLiquidation);

    await oracle.setOptions(quoteToken, baseToken, secAgo, secAgoLiq, oldParams.uniswapFee);

    const newParams = await oracle.getParams(quoteToken, baseToken);

    expect(newParams.initialized).to.be.true;
    expect(newParams.secondsAgo).to.be.eq(secAgo);
    expect(newParams.secondsAgoLiquidation).to.be.eq(secAgoLiq);
  });

  it('set new params, not owner', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleForward);

    const notOwner = (await ethers.getSigners())[1];

    const oldParams = await oracle.getParams(quoteToken, baseToken);
    await expect(
      oracle.connect(notOwner).setOptions(quoteToken, baseToken, 1000, 6, oldParams.uniswapFee)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('set new params, wrong fee', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleForward);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    const fee = 1000;
    expect(fee).to.be.not.eq(oldParams.uniswapFee);

    await expect(oracle.setOptions(quoteToken, baseToken, 900, 5, fee)).to.be.revertedWithCustomError(
      oracle,
      'CannotChangeUnderlyingPool'
    );
  });

  it('set new params, zero secondsAgo', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleForward);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    await expect(oracle.setOptions(quoteToken, baseToken, 0, 5, oldParams.uniswapFee)).to.be.revertedWithCustomError(
      oracle,
      'WrongValue'
    );
  });

  it('set new params, zero secondsAgoLiquidation', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleForward);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    await expect(oracle.setOptions(quoteToken, baseToken, 900, 0, oldParams.uniswapFee)).to.be.revertedWithCustomError(
      oracle,
      'WrongValue'
    );
  });

  it('oracle initialization, no uniswap Pool', async () => {
    const { oracle, uniswapFactory } = await loadFixture(createUniswapV3TickOracleForward);

    const fee = 300;
    const quoteToken = '0x0000000000000000000000000000000000000bad';
    const baseToken = '0x000000000000000000000000000000000000dead';
    expect(await uniswapFactory.getPool(quoteToken, baseToken, fee)).to.be.eq(
      '0x0000000000000000000000000000000000000000'
    );

    await expect(oracle.setOptions(quoteToken, baseToken, 900, 5, fee)).to.be.revertedWithCustomError(
      oracle,
      'UnknownPool'
    );
  });
});

describe('UniswapV3TickOracleDouble prices', () => {
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

describe('UniswapV3TickOracleDouble tech methods', () => {
  it('set new params', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    const secAgo = 1000;
    expect(secAgo).to.be.not.eq(oldParams.secondsAgo);
    const secAgoLiq = 6;
    expect(secAgoLiq).to.be.not.eq(oldParams.secondsAgoLiquidation);

    await oracle.setOptions(
      quoteToken,
      baseToken,
      secAgo,
      secAgoLiq,
      oldParams.baseTokenPairFee,
      oldParams.quoteTokenPairFee,
      oldParams.intermediateToken
    );

    const newParams = await oracle.getParams(quoteToken, baseToken);

    expect(newParams.initialized).to.be.true;
    expect(newParams.secondsAgo).to.be.eq(secAgo);
    expect(newParams.secondsAgoLiquidation).to.be.eq(secAgoLiq);
  });

  it('set new params, not owner', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const notOwner = (await ethers.getSigners())[1];

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    await expect(
      oracle
        .connect(notOwner)
        .setOptions(
          quoteToken,
          baseToken,
          1000,
          6,
          oldParams.baseTokenPairFee,
          oldParams.quoteTokenPairFee,
          oldParams.intermediateToken
        )
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('set new params, wrong base pair fee', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    const fee = 1000;
    expect(fee).to.be.not.eq(oldParams.baseTokenPairFee);

    await expect(
      oracle.setOptions(quoteToken, baseToken, 900, 5, fee, oldParams.quoteTokenPairFee, oldParams.intermediateToken)
    ).to.be.revertedWithCustomError(oracle, 'CannotChangeUnderlyingPool');
  });

  it('set new params, wrong quote pair fee', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    const fee = 1000;
    expect(fee).to.be.not.eq(oldParams.quoteTokenPairFee);

    await expect(
      oracle.setOptions(quoteToken, baseToken, 900, 5, oldParams.baseTokenPairFee, fee, oldParams.intermediateToken)
    ).to.be.revertedWithCustomError(oracle, 'CannotChangeUnderlyingPool');
  });

  it('set new params, wrong intermediate token', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    const intermediateToken = '0x000000000000000000000000000000000000dead';
    expect(intermediateToken).to.be.not.eq(oldParams.intermediateToken);

    await expect(
      oracle.setOptions(
        quoteToken,
        baseToken,
        900,
        5,
        oldParams.baseTokenPairFee,
        oldParams.quoteTokenPairFee,
        intermediateToken
      )
    ).to.be.revertedWithCustomError(oracle, 'CannotChangeUnderlyingPool');
  });

  it('set new params, zero secondsAgo', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    await expect(
      oracle.setOptions(
        quoteToken,
        baseToken,
        0,
        5,
        oldParams.baseTokenPairFee,
        oldParams.quoteTokenPairFee,
        oldParams.intermediateToken
      )
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('set new params, zero secondsAgoLiquidation', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const oldParams = await oracle.getParams(quoteToken, baseToken);

    await expect(
      oracle.setOptions(
        quoteToken,
        baseToken,
        900,
        0,
        oldParams.baseTokenPairFee,
        oldParams.quoteTokenPairFee,
        oldParams.intermediateToken
      )
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('oracle initialization, no base uniswap pool', async () => {
    const { oracle, uniswapFactory, baseToken, quoteToken, intermediateToken } = await loadFixture(
      createUniswapV3TickOracleDoubleIBQ
    );

    const fee = 300;
    const otherBaseToken = '0x0000000000000000000000000000000000000bad';
    expect(await uniswapFactory.getPool(intermediateToken, otherBaseToken, fee)).to.be.eq(
      '0x0000000000000000000000000000000000000000'
    );

    await expect(
      oracle.setOptions(quoteToken, otherBaseToken, 900, 5, fee, fee, intermediateToken)
    ).to.be.revertedWithCustomError(oracle, 'UnknownPool');
  });

  it('oracle initialization, no quote uniswap pool', async () => {
    const { oracle, uniswapFactory, baseToken, quoteToken, intermediateToken } = await loadFixture(
      createUniswapV3TickOracleDoubleIBQ
    );

    const fee = 300;
    const otherQuoteToken = '0x0000000000000000000000000000000000000bad';
    expect(await uniswapFactory.getPool(intermediateToken, otherQuoteToken, fee)).to.be.eq(
      '0x0000000000000000000000000000000000000000'
    );

    await expect(
      oracle.setOptions(otherQuoteToken, baseToken, 900, 5, fee, fee, intermediateToken)
    ).to.be.revertedWithCustomError(oracle, 'UnknownPool');
  });
});
