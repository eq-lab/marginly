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

    const paramsStruct = ['uint16', 'uint16', 'uint24'];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    const secAgo = 1000;
    expect(secAgo).to.be.not.eq(oldParams[0]);
    const secAgoLiq = 6;
    expect(secAgoLiq).to.be.not.eq(oldParams[1]);

    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [secAgo, secAgoLiq, oldParams[2]]);
    await oracle.setOptions(quoteToken, baseToken, newParamsEncoded);

    const newParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    expect(newParams[0]).to.be.eq(secAgo);
    expect(newParams[1]).to.be.eq(secAgoLiq);
  });

  it('set new params, not owner', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleForward);

    const paramsStruct = ['uint16', 'uint16', 'uint24'];

    const notOwner = (await ethers.getSigners())[1];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );
    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [1000, 6, oldParams[2]]);
    await expect(oracle.connect(notOwner).setOptions(quoteToken, baseToken, newParamsEncoded)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('set new params, wrong fee', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleForward);

    const paramsStruct = ['uint16', 'uint16', 'uint24'];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    const fee = 1000;
    expect(fee).to.be.not.eq(oldParams[2]);

    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [900, 5, fee]);
    await expect(oracle.setOptions(quoteToken, baseToken, newParamsEncoded)).to.be.revertedWithCustomError(
      oracle,
      'CannotChangeUnderlyingPool'
    );
  });

  it('set new params, zero secondsAgo', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleForward);

    const paramsStruct = ['uint16', 'uint16', 'uint24'];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [0, 5, oldParams[2]]);
    await expect(oracle.setOptions(quoteToken, baseToken, newParamsEncoded)).to.be.revertedWithCustomError(
      oracle,
      'WrongValue'
    );
  });

  it('set new params, zero secondsAgoLiquidation', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleForward);

    const paramsStruct = ['uint16', 'uint16', 'uint24'];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [900, 0, oldParams[2]]);
    await expect(oracle.setOptions(quoteToken, baseToken, newParamsEncoded)).to.be.revertedWithCustomError(
      oracle,
      'WrongValue'
    );
  });

  it('oracle initialization, no uniswap Pool', async () => {
    const { oracle, uniswapFactory } = await loadFixture(createUniswapV3TickOracleForward);

    const paramsStruct = ['uint16', 'uint16', 'uint24'];
    const fee = 300;
    const quoteToken = '0x0000000000000000000000000000000000000bad';
    const baseToken = '0x000000000000000000000000000000000000dead';
    expect(await uniswapFactory.getPool(quoteToken, baseToken, fee)).to.be.eq(
      '0x0000000000000000000000000000000000000000'
    );

    const paramsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [900, 5, fee]);
    await expect(oracle.setOptions(quoteToken, baseToken, paramsEncoded)).to.be.revertedWithCustomError(
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

    const paramsStruct = ['uint16', 'uint16', 'uint24', 'uint24', 'address'];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    const secAgo = 1000;
    expect(secAgo).to.be.not.eq(oldParams[0]);
    const secAgoLiq = 6;
    expect(secAgoLiq).to.be.not.eq(oldParams[1]);

    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [
      secAgo,
      secAgoLiq,
      oldParams[2],
      oldParams[3],
      oldParams[4],
    ]);
    await oracle.setOptions(quoteToken, baseToken, newParamsEncoded);

    const newParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    expect(newParams[0]).to.be.eq(secAgo);
    expect(newParams[1]).to.be.eq(secAgoLiq);
  });

  it('set new params, not owner', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const paramsStruct = ['uint16', 'uint16', 'uint24', 'uint24', 'address'];

    const notOwner = (await ethers.getSigners())[1];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );
    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [
      1000,
      6,
      oldParams[2],
      oldParams[3],
      oldParams[4],
    ]);
    await expect(oracle.connect(notOwner).setOptions(quoteToken, baseToken, newParamsEncoded)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('set new params, wrong base pair fee', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const paramsStruct = ['uint16', 'uint16', 'uint24', 'uint24', 'address'];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    const fee = 1000;
    expect(fee).to.be.not.eq(oldParams[2]);

    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [
      900,
      5,
      fee,
      oldParams[3],
      oldParams[4],
    ]);
    await expect(oracle.setOptions(quoteToken, baseToken, newParamsEncoded)).to.be.revertedWithCustomError(
      oracle,
      'CannotChangeUnderlyingPool'
    );
  });

  it('set new params, wrong quote pair fee', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const paramsStruct = ['uint16', 'uint16', 'uint24', 'uint24', 'address'];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    const fee = 1000;
    expect(fee).to.be.not.eq(oldParams[3]);

    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [
      900,
      5,
      oldParams[2],
      fee,
      oldParams[4],
    ]);
    await expect(oracle.setOptions(quoteToken, baseToken, newParamsEncoded)).to.be.revertedWithCustomError(
      oracle,
      'CannotChangeUnderlyingPool'
    );
  });

  it('set new params, wrong intermediate token', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const paramsStruct = ['uint16', 'uint16', 'uint24', 'uint24', 'address'];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    const intermediateToken = '0x000000000000000000000000000000000000dead';
    expect(intermediateToken).to.be.not.eq(oldParams[4]);

    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [
      900,
      5,
      oldParams[2],
      oldParams[3],
      intermediateToken,
    ]);
    await expect(oracle.setOptions(quoteToken, baseToken, newParamsEncoded)).to.be.revertedWithCustomError(
      oracle,
      'CannotChangeUnderlyingPool'
    );
  });

  it('set new params, zero secondsAgo', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const paramsStruct = ['uint16', 'uint16', 'uint24', 'uint24', 'address'];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [
      0,
      5,
      oldParams[2],
      oldParams[3],
      oldParams[4],
    ]);
    await expect(oracle.setOptions(quoteToken, baseToken, newParamsEncoded)).to.be.revertedWithCustomError(
      oracle,
      'WrongValue'
    );
  });

  it('set new params, zero secondsAgoLiquidation', async () => {
    const { oracle, quoteToken, baseToken } = await loadFixture(createUniswapV3TickOracleDoubleIBQ);

    const paramsStruct = ['uint16', 'uint16', 'uint24', 'uint24', 'address'];

    const oldParams = ethers.utils.defaultAbiCoder.decode(
      paramsStruct,
      await oracle.getParamsEncoded(quoteToken, baseToken)
    );

    const newParamsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [
      900,
      0,
      oldParams[2],
      oldParams[3],
      oldParams[4],
    ]);
    await expect(oracle.setOptions(quoteToken, baseToken, newParamsEncoded)).to.be.revertedWithCustomError(
      oracle,
      'WrongValue'
    );
  });

  it('oracle initialization, no base uniswap pool', async () => {
    const { oracle, uniswapFactory, baseToken, quoteToken, intermediateToken } = await loadFixture(
      createUniswapV3TickOracleDoubleIBQ
    );

    const paramsStruct = ['uint16', 'uint16', 'uint24', 'uint24', 'address'];
    const fee = 300;
    const otherBaseToken = '0x0000000000000000000000000000000000000bad';
    expect(await uniswapFactory.getPool(intermediateToken, otherBaseToken, fee)).to.be.eq(
      '0x0000000000000000000000000000000000000000'
    );

    const paramsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [900, 5, fee, fee, intermediateToken]);
    await expect(oracle.setOptions(quoteToken, otherBaseToken, paramsEncoded)).to.be.revertedWithCustomError(
      oracle,
      'UnknownPool'
    );
  });

  it('oracle initialization, no quote uniswap pool', async () => {
    const { oracle, uniswapFactory, baseToken, quoteToken, intermediateToken } = await loadFixture(
      createUniswapV3TickOracleDoubleIBQ
    );

    const paramsStruct = ['uint16', 'uint16', 'uint24', 'uint24', 'address'];
    const fee = 300;
    const otherQuoteToken = '0x0000000000000000000000000000000000000bad';
    expect(await uniswapFactory.getPool(intermediateToken, otherQuoteToken, fee)).to.be.eq(
      '0x0000000000000000000000000000000000000000'
    );

    const paramsEncoded = ethers.utils.defaultAbiCoder.encode(paramsStruct, [900, 5, fee, fee, intermediateToken]);
    await expect(oracle.setOptions(otherQuoteToken, baseToken, paramsEncoded)).to.be.revertedWithCustomError(
      oracle,
      'UnknownPool'
    );
  });
});
