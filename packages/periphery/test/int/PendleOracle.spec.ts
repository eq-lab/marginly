import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { createPendleCaseEzETH27Jun2024, PendleOracleCaseParams } from '../shared/fixtures';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

// Details:
// 1) Pendle market: PT / SY. (PT-ezETH-27JUN2024 / SY-ezETH)
// 2) 1.0 SY == 1.0 YQT. (1.0 SY-ezETH == 1.0 ezETH)
// 3) Camelot pool: YQT / QT. (ezETH / WETH)

const oneX96 = BigNumber.from(2).pow(96);
const one = BigNumber.from(10).pow(18);
function printPrices(
  actualPrice: BigNumber,
  priceFromPendlePtLpOracle: BigNumber,
  priceFromSecondaryOracle: BigNumber,
  expectedPrice: BigNumber
) {
  const priceDelta = actualPrice.sub(expectedPrice);
  console.log(`Price from PendlePtLpOracle: ${ethers.utils.formatEther(priceFromPendlePtLpOracle)}`);
  console.log(`Price from SecondaryOracle: ${ethers.utils.formatEther(priceFromSecondaryOracle)}`);
  console.log(`Final expected price: ${ethers.utils.formatEther(expectedPrice)}`);
  console.log(`Actual price: ${ethers.utils.formatEther(actualPrice)}`);
  console.log(`Delta: ${ethers.utils.formatEther(priceDelta)}`);
}

async function fetchPrices(
  params: PendleOracleCaseParams,
  blockTag?: number
): Promise<{
  actualBalancePrice: BigNumber;
  actualMargincallPrice: BigNumber;
  balancePriceFromPendlePtLpOracle: BigNumber;
  margincallPriceFromPendlePtLpOracle: BigNumber;
  balancePriceFromSecondaryOracle: BigNumber;
  margincallPriceFromSecondaryOracle: BigNumber;
}> {
  const actualBalancePrice = (await params.oracle.getBalancePrice(params.qt.address, params.pt.address, { blockTag }))
    .mul(one)
    .div(oneX96);
  const actualMargincallPrice = (
    await params.oracle.getMargincallPrice(params.qt.address, params.pt.address, { blockTag })
  )
    .mul(one)
    .div(oneX96);
  const balancePriceFromPendlePtLpOracle = await params.pendlePtLpOracle.getPtToSyRate(
    params.pendleMarket.address,
    params.secondsAgo,
    { blockTag }
  );
  const margincallPriceFromPendlePtLpOracle = await params.pendlePtLpOracle.getPtToSyRate(
    params.pendleMarket.address,
    params.secondsAgoLiquidation,
    { blockTag }
  );
  const balancePriceFromSecondaryOracle = (
    await params.secondaryPoolOracle.getBalancePrice(params.qt.address, params.yqt.address, { blockTag })
  )
    .mul(one)
    .div(oneX96);
  const margincallPriceFromSecondaryOracle = (
    await params.secondaryPoolOracle.getMargincallPrice(params.qt.address, params.yqt.address, { blockTag })
  )
    .mul(one)
    .div(oneX96);

  return {
    actualBalancePrice,
    actualMargincallPrice,
    balancePriceFromPendlePtLpOracle,
    balancePriceFromSecondaryOracle,
    margincallPriceFromPendlePtLpOracle,
    margincallPriceFromSecondaryOracle,
  };
}

describe('Pendle PT oracle (PendleOracle)', () => {
  it('PT-ezETH-27Jun2024 / WETH. Current prices', async () => {
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
