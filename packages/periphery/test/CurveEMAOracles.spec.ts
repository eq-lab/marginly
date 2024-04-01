import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  createCurveEMAOracleBackward,
  createCurveEMAOracleForward,
  createCurveEMAOracleWithoutAddingPool,
} from './shared/fixtures';
import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat';

const X96One = 1n << 96n;

function assertOracleParamsIsEmpty(oracleParams: {
  pool: string;
  isForwardOrder: boolean;
  baseDecimals: number;
  quoteDecimals: number;
}) {
  expect(oracleParams.pool).to.be.equal(constants.AddressZero);
  expect(oracleParams.baseDecimals).to.be.equal(0);
  expect(oracleParams.quoteDecimals).to.be.equal(0);
  expect(oracleParams.isForwardOrder).to.be.equal(false);
}

function assertOracleParamsIsFilled(
  oracleParams: {
    pool: string;
    isForwardOrder: boolean;
    baseDecimals: number;
    quoteDecimals: number;
  },
  actualPool: string,
  isForwardOrder: boolean
) {
  expect(oracleParams.pool).to.be.equal(actualPool);
  expect(oracleParams.baseDecimals).to.be.equal(18);
  expect(oracleParams.quoteDecimals).to.be.equal(18);
  expect(oracleParams.isForwardOrder).to.be.equal(isForwardOrder);
}

describe('CurveEMAPriceOracle', () => {
  it('forward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createCurveEMAOracleForward);

    const paramsOrder1 = await oracle.getParams(quoteToken, baseToken);
    const paramsOrder2 = await oracle.getParams(baseToken, quoteToken);
    assertOracleParamsIsFilled(paramsOrder1, pool.address, true);
    assertOracleParamsIsFilled(paramsOrder2, pool.address, true);

    const priceFromPool = await pool.price_oracle();

    const balancePriceFromOracleX96 = await oracle.getBalancePrice(quoteToken, baseToken);
    const margincallPriceFromOracleX96 = await oracle.getMargincallPrice(quoteToken, baseToken);

    const balancePriceFromOracle = balancePriceFromOracleX96.div(X96One);
    const margincallPriceFromOracle = margincallPriceFromOracleX96.div(X96One);

    expect(balancePriceFromOracle).to.be.equal(priceFromPool);
    expect(margincallPriceFromOracle).to.be.equal(priceFromPool);
  });

  it('backward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createCurveEMAOracleBackward);
    const one = BigNumber.from(10).pow(18);

    const paramsOrder1 = await oracle.getParams(quoteToken, baseToken);
    const paramsOrder2 = await oracle.getParams(baseToken, quoteToken);
    assertOracleParamsIsFilled(paramsOrder1, pool.address, false);
    assertOracleParamsIsFilled(paramsOrder2, pool.address, false);

    let priceFromPool = await pool.price_oracle();
    // inverse price
    priceFromPool = one.sub(priceFromPool.sub(one));

    const balancePriceFromOracleX96 = await oracle.getBalancePrice(baseToken, quoteToken);
    const margincallPriceFromOracleX96 = await oracle.getMargincallPrice(baseToken, quoteToken);

    let balancePriceFromOracle = balancePriceFromOracleX96.div(X96One);
    let margincallPriceFromOracle = margincallPriceFromOracleX96.div(X96One);

    expect(balancePriceFromOracle).to.be.equal(priceFromPool);
    expect(margincallPriceFromOracle).to.be.equal(priceFromPool);
  });

  it('zero price', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createCurveEMAOracleBackward);
    await pool.setPrices(0, 0, 0);

    await expect(oracle.getBalancePrice(quoteToken, baseToken)).to.be.revertedWithCustomError(oracle, 'ZeroPrice');
    await expect(oracle.getMargincallPrice(quoteToken, baseToken)).to.be.revertedWithCustomError(oracle, 'ZeroPrice');
  });

  it('add pool rights', async () => {
    const [, user] = await ethers.getSigners();
    const {
      oracle: oracleOwnerConnected,
      pool,
      quoteToken,
      baseToken,
    } = await loadFixture(createCurveEMAOracleWithoutAddingPool);

    const paramsBeforeOrder1 = await oracleOwnerConnected.getParams(quoteToken, baseToken);
    const paramsBeforeOrder2 = await oracleOwnerConnected.getParams(baseToken, quoteToken);
    assertOracleParamsIsEmpty(paramsBeforeOrder1);
    assertOracleParamsIsEmpty(paramsBeforeOrder2);

    const oracleUserConnected = oracleOwnerConnected.connect(user);
    await expect(oracleUserConnected.addPool(pool.address, baseToken, quoteToken)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await oracleOwnerConnected.addPool(pool.address, baseToken, quoteToken);
    const paramsAfterOrder1 = await oracleOwnerConnected.getParams(quoteToken, baseToken);
    const paramsAfterOrder2 = await oracleOwnerConnected.getParams(baseToken, quoteToken);
    assertOracleParamsIsFilled(paramsAfterOrder1, pool.address, false);
    assertOracleParamsIsFilled(paramsAfterOrder2, pool.address, false);
  });

  it('add pool invalid', async () => {
    const { oracle, pool, quoteToken, baseToken, anotherToken } = await loadFixture(
      createCurveEMAOracleWithoutAddingPool
    );

    await expect(oracle.addPool(constants.AddressZero, baseToken, quoteToken)).to.be.revertedWithCustomError(
      oracle,
      'ZeroAddress'
    );
    await expect(oracle.addPool(pool.address, constants.AddressZero, quoteToken)).to.be.revertedWithCustomError(
      oracle,
      'ZeroAddress'
    );
    await expect(oracle.addPool(pool.address, baseToken, constants.AddressZero)).to.be.revertedWithCustomError(
      oracle,
      'ZeroAddress'
    );
    await expect(oracle.addPool(pool.address, baseToken, baseToken)).to.be.revertedWithCustomError(
      oracle,
      'InvalidTokenAddress'
    );
    await expect(oracle.addPool(pool.address, baseToken, anotherToken)).to.be.revertedWithCustomError(
      oracle,
      'InvalidTokenAddress'
    );
    await expect(oracle.addPool(pool.address, anotherToken, quoteToken)).to.be.revertedWithCustomError(
      oracle,
      'InvalidTokenAddress'
    );
  });

  it('remove pool rights', async () => {
    const [, user] = await ethers.getSigners();
    const {
      oracle: oracleOwnerConnected,
      pool,
      quoteToken,
      baseToken,
    } = await loadFixture(createCurveEMAOracleBackward);

    const paramsBeforeOrder1 = await oracleOwnerConnected.getParams(quoteToken, baseToken);
    const paramsBeforeOrder2 = await oracleOwnerConnected.getParams(baseToken, quoteToken);

    assertOracleParamsIsFilled(paramsBeforeOrder1, pool.address, false);
    assertOracleParamsIsFilled(paramsBeforeOrder2, pool.address, false);

    const oracleUserConnected = oracleOwnerConnected.connect(user);
    await expect(oracleUserConnected.removePool(baseToken, quoteToken)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await oracleOwnerConnected.removePool(baseToken, quoteToken);
    const paramsAfterOrder1 = await oracleOwnerConnected.getParams(quoteToken, baseToken);
    const paramsAfterOrder2 = await oracleOwnerConnected.getParams(baseToken, quoteToken);
    assertOracleParamsIsEmpty(paramsAfterOrder1);
    assertOracleParamsIsEmpty(paramsAfterOrder2);
  });
});
