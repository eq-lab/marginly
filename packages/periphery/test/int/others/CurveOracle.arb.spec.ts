import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { createCurveCaseCrvUsdUsdc, createCurveCaseFrxEthWeth, CurveOracleCaseParams } from '../../shared/fixtures';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { oneX96 } from '../pendle/common';
import { ethers } from 'hardhat';

async function fetchCurvePrices(
  params: CurveOracleCaseParams,
  blockTag?: number
): Promise<{
  actualBalancePrice: BigNumber;
  actualMargincallPrice: BigNumber;
  expectedBalancePrice: BigNumber;
  expectedMargincallPrice: BigNumber;
}> {
  const multiplier = BigNumber.from(10).pow(18 + params.baseToken.decimals - params.quoteToken.decimals);

  let actualBalancePrice = (
    await params.oracle.getBalancePrice(params.quoteToken.address, params.baseToken.address, { blockTag })
  )
    .mul(multiplier)
    .div(oneX96);

  const actualMargincallPrice = (
    await params.oracle.getMargincallPrice(params.quoteToken.address, params.baseToken.address, { blockTag })
  )
    .mul(multiplier)
    .div(oneX96);

  let expectedBalancePrice: BigNumber;

  if (params.priceOracleMethodHasArg) {
    expectedBalancePrice = await params.pool['price_oracle(uint256)'](0, { blockTag });
  } else {
    expectedBalancePrice = await params.pool['price_oracle()']({ blockTag });
  }

  if (!params.isToken0QuoteToken) {
    const one = BigNumber.from(10).pow(18);
    expectedBalancePrice = one.mul(one).div(expectedBalancePrice);
  }

  return {
    actualBalancePrice,
    actualMargincallPrice,
    expectedBalancePrice,
    expectedMargincallPrice: expectedBalancePrice,
  };
}

export function printCurvePrices(actualPrice: BigNumber, expectedPrice: BigNumber, caseParams: CurveOracleCaseParams) {
  const priceDelta = actualPrice.sub(expectedPrice);
  console.log(
    `  Expected price: 1.0 ${caseParams.baseToken.symbol} = ${ethers.utils.formatEther(expectedPrice)} ${
      caseParams.quoteToken.symbol
    }`
  );
  console.log(
    `  Actual price:   1.0 ${caseParams.baseToken.symbol} = ${ethers.utils.formatEther(actualPrice)} ${
      caseParams.quoteToken.symbol
    }`
  );
  console.log(`  Delta: ${ethers.utils.formatEther(priceDelta)}`);
}

describe('CurveOracle', () => {
  it('frxETH/WETH: without arg in method', async () => {
    const caseParams = await loadFixture(createCurveCaseFrxEthWeth);

    const { actualBalancePrice, actualMargincallPrice, expectedBalancePrice, expectedMargincallPrice } =
      await fetchCurvePrices(caseParams);

    console.log(`\nBalance price:`);
    printCurvePrices(actualBalancePrice, expectedBalancePrice, caseParams);
    console.log(`\nMargincall price:`);
    printCurvePrices(actualMargincallPrice, expectedMargincallPrice, caseParams);

    expect(actualBalancePrice).to.be.closeTo(expectedBalancePrice, BigNumber.from(1000));
    expect(actualMargincallPrice).to.be.closeTo(expectedMargincallPrice, BigNumber.from(1000));
  });

  it('crvUSD/USDC: with arg in method', async () => {
    const caseParams = await loadFixture(createCurveCaseCrvUsdUsdc);

    const { actualBalancePrice, actualMargincallPrice, expectedBalancePrice, expectedMargincallPrice } =
      await fetchCurvePrices(caseParams);

    console.log(`\nBalance price:`);
    printCurvePrices(actualBalancePrice, expectedBalancePrice, caseParams);
    console.log(`\nMargincall price:`);
    printCurvePrices(actualMargincallPrice, expectedMargincallPrice, caseParams);

    expect(actualBalancePrice).to.be.closeTo(expectedBalancePrice, BigNumber.from(1000));
    expect(actualMargincallPrice).to.be.closeTo(expectedMargincallPrice, BigNumber.from(1000));
  });
});
