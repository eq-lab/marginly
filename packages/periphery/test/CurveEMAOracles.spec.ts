import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { createCurveEMAOracleBackward, createCurveEMAOracleForward } from './shared/fixtures';
import { BigNumber } from 'ethers';

const X96One = 1n << 96n;

describe('CurveEMAPriceOracle', () => {
  it('forward', async () => {
    const { oracle, pool, quoteToken, baseToken } = await loadFixture(createCurveEMAOracleForward);

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
});
