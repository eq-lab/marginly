import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  createPendleMarketOracle,
  createPendleMarketOracleAfterMaturity,
  createPendleMarketOracleWithoutPairs,
} from './shared/fixtures';
import { one, oneX96 } from './int/pendle/common';

describe('PendleMarketOracle prices before maturity', () => {
  it('getBalancePrice', async () => {
    const caseParams = await loadFixture(createPendleMarketOracle);

    const actualPrice = (await caseParams.oracle.getBalancePrice(caseParams.ib.address, caseParams.pt.address))
      .mul(one)
      .div(oneX96);

    const expectedPrice = await caseParams.pendlePtLpOracle.getPtToSyRate(
      caseParams.pendleMarket.address,
      caseParams.secondsAgo
    );

    expect(actualPrice).to.be.closeTo(expectedPrice, 100);
  });

  it('getBalancePrice inverted', async () => {
    const caseParams = await loadFixture(createPendleMarketOracle);

    const actualPrice = oneX96
      .mul(one)
      .div(await caseParams.oracle.getBalancePrice(caseParams.pt.address, caseParams.ib.address));

    const expectedPrice = await caseParams.pendlePtLpOracle.getPtToSyRate(
      caseParams.pendleMarket.address,
      caseParams.secondsAgo
    );

    expect(actualPrice).to.be.closeTo(expectedPrice, 100);
  });

  it('getMargincallPrice', async () => {
    const caseParams = await loadFixture(createPendleMarketOracle);

    const actualPrice = (await caseParams.oracle.getMargincallPrice(caseParams.ib.address, caseParams.pt.address))
      .mul(one)
      .div(oneX96);

    const expectedPrice = await caseParams.pendlePtLpOracle.getPtToSyRate(
      caseParams.pendleMarket.address,
      caseParams.secondsAgoLiquidation
    );

    expect(actualPrice).to.be.closeTo(expectedPrice, 100);
  });

  it('getMargincallPrice inverted', async () => {
    const caseParams = await loadFixture(createPendleMarketOracle);

    const actualPrice = oneX96
      .mul(one)
      .div(await caseParams.oracle.getMargincallPrice(caseParams.pt.address, caseParams.ib.address));

    const expectedPrice = await caseParams.pendlePtLpOracle.getPtToSyRate(
      caseParams.pendleMarket.address,
      caseParams.secondsAgoLiquidation
    );

    expect(actualPrice).to.be.closeTo(expectedPrice, 100);
  });

  it('updateTwapDuration', async () => {
    const caseParams = await loadFixture(createPendleMarketOracle);
    const paramsBefore = await caseParams.oracle.getParams(caseParams.ib.address, caseParams.pt.address);

    const newSecondsAgo = caseParams.secondsAgo + 1000;
    const newSecondsAgoLiquidation = caseParams.secondsAgoLiquidation + 1000;

    await caseParams.oracle.updateTwapDuration(
      caseParams.ib.address,
      caseParams.pt.address,
      newSecondsAgo,
      newSecondsAgoLiquidation
    );
    let paramsAfter = await caseParams.oracle.getParams(caseParams.ib.address, caseParams.pt.address);

    // printPendlePrices(actualPrice, one, priceFromSecondaryOracle, priceFromSecondaryOracle);
    expect(paramsAfter.pendleMarket).to.be.equal(paramsBefore.pendleMarket);
    expect(paramsAfter.secondsAgo).to.be.equal(newSecondsAgo);
    expect(paramsAfter.secondsAgoLiquidation).to.be.equal(newSecondsAgoLiquidation);

    paramsAfter = await caseParams.oracle.getParams(caseParams.pt.address, caseParams.ib.address);
    expect(paramsAfter.pendleMarket).to.be.equal(paramsBefore.pendleMarket);
    expect(paramsAfter.secondsAgo).to.be.equal(newSecondsAgo);
    expect(paramsAfter.secondsAgoLiquidation).to.be.equal(newSecondsAgoLiquidation);
  });

  it('updateTwapDuration. Fail', async () => {
    const caseParams = await loadFixture(createPendleMarketOracle);
    const params = await caseParams.oracle.getParams(caseParams.ib.address, caseParams.pt.address);

    const newSecondsAgo = 100;
    const newSecondsAgoLiquidation = 1000;

    await expect(
      caseParams.oracle.updateTwapDuration(
        caseParams.ib.address,
        caseParams.pt.address,
        newSecondsAgo,
        newSecondsAgoLiquidation
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'WrongValue');

    await expect(
      caseParams.oracle.updateTwapDuration(
        '0x0000000000000000000000000000000000000000',
        caseParams.pt.address,
        params.secondsAgo,
        params.secondsAgoLiquidation
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'UnknownPair');
  });

  it('setPair. Fail', async () => {
    const caseParams = await loadFixture(createPendleMarketOracleWithoutPairs);

    await expect(
      caseParams.oracle.setPair(
        caseParams.ib.address,
        caseParams.pt.address,
        caseParams.pendleMarket.address,
        100,
        1000
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'WrongValue');

    await expect(
      caseParams.oracle.setPair(caseParams.ib.address, caseParams.pt.address, caseParams.pendleMarket.address, 1000, 0)
    ).to.be.revertedWithCustomError(caseParams.oracle, 'WrongValue');

    await expect(
      caseParams.oracle.setPair(
        caseParams.ib.address,
        '0x0000000000000000000000000000000000000001',
        caseParams.pendleMarket.address,
        1000,
        100
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'WrongPtAddress');

    await caseParams.sy.setIsValidTokenInOut(true, false);
    await expect(
      caseParams.oracle.setPair(
        caseParams.ib.address,
        caseParams.pt.address,
        caseParams.pendleMarket.address,
        1000,
        100
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'WrongIbTokenAddress');

    await caseParams.sy.setIsValidTokenInOut(false, true);
    await expect(
      caseParams.oracle.setPair(
        caseParams.ib.address,
        caseParams.pt.address,
        caseParams.pendleMarket.address,
        1000,
        100
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'WrongIbTokenAddress');
  });

  it('setPair. Fail pair already exists', async () => {
    const caseParams = await loadFixture(createPendleMarketOracle);
    await expect(
      caseParams.oracle.setPair(
        caseParams.ib.address,
        caseParams.pt.address,
        caseParams.pendleMarket.address,
        1000,
        100
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'PairAlreadyExist');
  });
});

describe('PendleOracle prices after maturity', () => {
  it('getBalancePrice', async () => {
    const caseParams = await loadFixture(createPendleMarketOracleAfterMaturity);

    const actualPrice = (await caseParams.oracle.getBalancePrice(caseParams.ib.address, caseParams.pt.address))
      .mul(one)
      .div(oneX96);

    const expectedPrice = await caseParams.pendlePtLpOracle.getPtToSyRate(
      caseParams.pendleMarket.address,
      caseParams.secondsAgo
    );

    expect(actualPrice).to.be.closeTo(expectedPrice, 100);
  });

  it('getMargincallPrice', async () => {
    const caseParams = await loadFixture(createPendleMarketOracleAfterMaturity);

    const actualPrice = (await caseParams.oracle.getMargincallPrice(caseParams.ib.address, caseParams.pt.address))
      .mul(one)
      .div(oneX96);

    const expectedPrice = await caseParams.pendlePtLpOracle.getPtToSyRate(
      caseParams.pendleMarket.address,
      caseParams.secondsAgoLiquidation
    );

    expect(actualPrice).to.be.closeTo(expectedPrice, 100);
  });
});
