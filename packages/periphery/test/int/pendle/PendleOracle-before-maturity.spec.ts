import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  createPendleCaseEzETH27Jun2024,
  createPendleCaseRsETH27Jun2024,
  createPendleCaseWeETH27Jun2024,
} from '../../shared/fixtures';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { fetchPrices, one, printPrices, printTokenSymbols } from './common';

describe('Pendle PT oracle before maturity (PendleOracle)', () => {
  it('PT-weETH-27JUN2024 / WETH', async () => {
    const caseParams = await loadFixture(createPendleCaseWeETH27Jun2024);

    const {
      actualBalancePrice,
      actualMargincallPrice,
      balancePriceFromPendlePtLpOracle,
      margincallPriceFromPendlePtLpOracle,
      balancePriceFromSecondaryOracle,
      margincallPriceFromSecondaryOracle,
    } = await fetchPrices(caseParams);

    const expectedBalancePrice = balancePriceFromPendlePtLpOracle.mul(balancePriceFromSecondaryOracle).div(one);
    const expectedMargincallPrice = margincallPriceFromPendlePtLpOracle
      .mul(margincallPriceFromSecondaryOracle)
      .div(one);

    printTokenSymbols(caseParams);

    console.log(`\nBalance price:`);
    printPrices(
      actualBalancePrice,
      balancePriceFromPendlePtLpOracle,
      balancePriceFromSecondaryOracle,
      expectedBalancePrice
    );
    console.log(`\nMargincall price:`);
    printPrices(
      actualMargincallPrice,
      margincallPriceFromPendlePtLpOracle,
      margincallPriceFromSecondaryOracle,
      expectedMargincallPrice
    );

    expect(actualBalancePrice).to.be.closeTo(expectedBalancePrice, BigNumber.from(1000));
    expect(actualMargincallPrice).to.be.closeTo(expectedMargincallPrice, BigNumber.from(1000));
  });

  it('PT-rsETH-27JUN2024 / WETH', async () => {
    const caseParams = await loadFixture(createPendleCaseRsETH27Jun2024);

    const {
      actualBalancePrice,
      actualMargincallPrice,
      balancePriceFromPendlePtLpOracle,
      margincallPriceFromPendlePtLpOracle,
      balancePriceFromSecondaryOracle,
      margincallPriceFromSecondaryOracle,
    } = await fetchPrices(caseParams);

    const expectedBalancePrice = balancePriceFromPendlePtLpOracle.mul(balancePriceFromSecondaryOracle).div(one);
    const expectedMargincallPrice = margincallPriceFromPendlePtLpOracle
      .mul(margincallPriceFromSecondaryOracle)
      .div(one);

    printTokenSymbols(caseParams);

    console.log(`\nBalance price:`);
    printPrices(
      actualBalancePrice,
      balancePriceFromPendlePtLpOracle,
      balancePriceFromSecondaryOracle,
      expectedBalancePrice
    );
    console.log(`\nMargincall price:`);
    printPrices(
      actualMargincallPrice,
      margincallPriceFromPendlePtLpOracle,
      margincallPriceFromSecondaryOracle,
      expectedMargincallPrice
    );

    expect(actualBalancePrice).to.be.closeTo(expectedBalancePrice, BigNumber.from(1000));
    expect(actualMargincallPrice).to.be.closeTo(expectedMargincallPrice, BigNumber.from(1000));
  });

  it('PT-ezETH-27JUN2024 / WETH', async () => {
    const caseParams = await loadFixture(createPendleCaseEzETH27Jun2024);

    const {
      actualBalancePrice,
      actualMargincallPrice,
      balancePriceFromPendlePtLpOracle,
      margincallPriceFromPendlePtLpOracle,
      balancePriceFromSecondaryOracle,
      margincallPriceFromSecondaryOracle,
    } = await fetchPrices(caseParams);

    const expectedBalancePrice = balancePriceFromPendlePtLpOracle.mul(balancePriceFromSecondaryOracle).div(one);
    const expectedMargincallPrice = margincallPriceFromPendlePtLpOracle
      .mul(margincallPriceFromSecondaryOracle)
      .div(one);

    printTokenSymbols(caseParams);

    console.log(`\nBalance price:`);
    printPrices(
      actualBalancePrice,
      balancePriceFromPendlePtLpOracle,
      balancePriceFromSecondaryOracle,
      expectedBalancePrice
    );
    console.log(`\nMargincall price:`);
    printPrices(
      actualMargincallPrice,
      margincallPriceFromPendlePtLpOracle,
      margincallPriceFromSecondaryOracle,
      expectedMargincallPrice
    );

    expect(actualBalancePrice).to.be.closeTo(expectedBalancePrice, BigNumber.from(1000));
    expect(actualMargincallPrice).to.be.closeTo(expectedMargincallPrice, BigNumber.from(1000));
  });
});
