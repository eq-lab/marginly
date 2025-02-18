import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { createPendleUnitTestCase, one, oneX96 } from './shared/fixtures';
import { ethers } from 'hardhat';

describe('PendleOracle prices before maturity', () => {
  it('getBalancePrice', async () => {
    const caseParams = await loadFixture(createPendleUnitTestCase);

    const actualPrice = (await caseParams.oracle.getBalancePrice(caseParams.qt.address, caseParams.pt.address))
      .mul(one)
      .div(oneX96);

    const priceFromPendlePtLpOracle = await caseParams.pendlePtLpOracle.getPtToSyRate(
      caseParams.pendleMarket.address,
      caseParams.secondsAgo
    );
    const priceFromSecondaryOracle = (
      await caseParams.secondaryPoolOracle.getBalancePrice(caseParams.qt.address, caseParams.yqt.address)
    )
      .mul(one)
      .div(oneX96);

    const expectedPrice = priceFromPendlePtLpOracle.mul(priceFromSecondaryOracle).div(one);

    // printPendlePrices(actualPrice, priceFromPendlePtLpOracle, priceFromSecondaryOracle, expectedPrice);
    expect(actualPrice).to.be.closeTo(expectedPrice, 100);
  });

  it('getMargincallPrice', async () => {
    const caseParams = await loadFixture(createPendleUnitTestCase);

    const actualPrice = (await caseParams.oracle.getMargincallPrice(caseParams.qt.address, caseParams.pt.address))
      .mul(one)
      .div(oneX96);

    const priceFromPendlePtLpOracle = await caseParams.pendlePtLpOracle.getPtToSyRate(
      caseParams.pendleMarket.address,
      caseParams.secondsAgoLiquidation
    );
    const priceFromSecondaryOracle = (
      await caseParams.secondaryPoolOracle.getMargincallPrice(caseParams.qt.address, caseParams.yqt.address)
    )
      .mul(one)
      .div(oneX96);

    const expectedPrice = priceFromPendlePtLpOracle.mul(priceFromSecondaryOracle).div(one);

    // printPendlePrices(actualPrice, priceFromPendlePtLpOracle, priceFromSecondaryOracle, expectedPrice);
    expect(actualPrice).to.be.closeTo(expectedPrice, 100);
  });

  it('updateTwapDuration', async () => {
    const caseParams = await loadFixture(createPendleUnitTestCase);
    const paramsBefore = await caseParams.oracle.getParams(caseParams.qt.address, caseParams.pt.address);

    const newSecondsAgo = caseParams.secondsAgo + 1000;
    const newSecondsAgoLiquidation = caseParams.secondsAgoLiquidation + 1000;

    await caseParams.oracle.updateTwapDuration(
      caseParams.qt.address,
      caseParams.pt.address,
      newSecondsAgo,
      newSecondsAgoLiquidation
    );
    const paramsAfter = await caseParams.oracle.getParams(caseParams.qt.address, caseParams.pt.address);

    // printPendlePrices(actualPrice, one, priceFromSecondaryOracle, priceFromSecondaryOracle);
    expect(paramsAfter.pendleMarket).to.be.equal(paramsBefore.pendleMarket);
    expect(paramsAfter.secondaryPoolOracle).to.be.equal(paramsBefore.secondaryPoolOracle);
    expect(paramsAfter.secondsAgo).to.be.equal(newSecondsAgo);
    expect(paramsAfter.secondsAgoLiquidation).to.be.equal(newSecondsAgoLiquidation);
  });

  it('updateTwapDuration. Fail', async () => {
    const caseParams = await loadFixture(createPendleUnitTestCase);
    const params = await caseParams.oracle.getParams(caseParams.qt.address, caseParams.pt.address);

    const newSecondsAgo = 100;
    const newSecondsAgoLiquidation = 1000;

    await expect(
      caseParams.oracle.updateTwapDuration(
        caseParams.qt.address,
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
    const caseParams = await loadFixture(createPendleUnitTestCase);
    const params = await caseParams.oracle.getParams(caseParams.qt.address, caseParams.pt.address);

    await expect(
      caseParams.oracle.setPair(
        caseParams.qt.address,
        caseParams.pt.address,
        params.pendleMarket,
        params.secondaryPoolOracle,
        caseParams.sy.address,
        100,
        1000
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'WrongValue');

    await expect(
      caseParams.oracle.setPair(
        caseParams.qt.address,
        caseParams.pt.address,
        params.pendleMarket,
        params.secondaryPoolOracle,
        caseParams.sy.address,
        1000,
        0
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'WrongValue');

    await expect(
      caseParams.oracle.setPair(
        caseParams.qt.address,
        caseParams.pt.address,
        '0x0000000000000000000000000000000000000000',
        params.secondaryPoolOracle,
        caseParams.sy.address,
        1000,
        100
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'ZeroAddress');

    await expect(
      caseParams.oracle.setPair(
        caseParams.qt.address,
        caseParams.pt.address,
        params.pendleMarket,
        params.secondaryPoolOracle,
        caseParams.sy.address,
        1000,
        100
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'PairAlreadyExist');

    await expect(
      caseParams.oracle.setPair(
        caseParams.qt.address,
        '0x0000000000000000000000000000000000000001',
        params.pendleMarket,
        params.secondaryPoolOracle,
        caseParams.sy.address,
        1000,
        100
      )
    ).to.be.revertedWithCustomError(caseParams.oracle, 'WrongPtAddress');
  });
});

describe('PendleOracle prices after maturity', () => {
  it('getBalancePrice', async () => {
    const caseParams = await loadFixture(createPendleUnitTestCase);

    await ethers.provider.send('evm_increaseTime', [12 * 24 * 60 * 60]);
    await ethers.provider.send('evm_mine', []);
    expect(await caseParams.pendleMarket.isExpired());

    const actualPrice = (await caseParams.oracle.getBalancePrice(caseParams.qt.address, caseParams.pt.address))
      .mul(one)
      .div(oneX96);

    const priceFromPendlePtLpOracle = await caseParams.pendlePtLpOracle.getPtToSyRate(
      caseParams.pendleMarket.address,
      caseParams.secondsAgo
    );

    const priceFromSecondaryOracle = (
      await caseParams.secondaryPoolOracle.getBalancePrice(caseParams.qt.address, caseParams.yqt.address)
    )
      .mul(one)
      .div(oneX96);

    const expectedPrice = priceFromPendlePtLpOracle.mul(priceFromSecondaryOracle).div(one);

    // printPendlePrices(actualPrice, one, priceFromSecondaryOracle, priceFromSecondaryOracle);
    expect(actualPrice).to.be.closeTo(expectedPrice, 100);
  });

  it('getMargincallPrice', async () => {
    const caseParams = await loadFixture(createPendleUnitTestCase);

    await ethers.provider.send('evm_increaseTime', [12 * 24 * 60 * 60]);
    await ethers.provider.send('evm_mine', []);
    expect(await caseParams.pendleMarket.isExpired());

    const actualPrice = (await caseParams.oracle.getMargincallPrice(caseParams.qt.address, caseParams.pt.address))
      .mul(one)
      .div(oneX96);

    const priceFromPendlePtLpOracle = await caseParams.pendlePtLpOracle.getPtToSyRate(
      caseParams.pendleMarket.address,
      caseParams.secondsAgo
    );

    const priceFromSecondaryOracle = (
      await caseParams.secondaryPoolOracle.getMargincallPrice(caseParams.qt.address, caseParams.yqt.address)
    )
      .mul(one)
      .div(oneX96);

    const expectedPrice = priceFromPendlePtLpOracle.mul(priceFromSecondaryOracle).div(one);

    // printPendlePrices(actualPrice, one, priceFromSecondaryOracle, priceFromSecondaryOracle);
    expect(actualPrice).to.be.closeTo(expectedPrice, 100);
  });
});
