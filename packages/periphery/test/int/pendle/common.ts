import { BigNumber } from 'ethers';
import { PendleOracleCaseParams } from '../../shared/fixtures';
import { ethers } from 'hardhat';

export const oneX96 = BigNumber.from(2).pow(96);
export const one = BigNumber.from(10).pow(18);

export function printPendleTokenSymbols(caseParams: PendleOracleCaseParams) {
  console.log(`\n\nTokens names:`);
  console.log(`  PT  = ${caseParams.pt.symbol}`);
  console.log(`  SY  = ${caseParams.sy.symbol}`);
  console.log(`  YQT = ${caseParams.yqt.symbol}`);
  console.log(`  QT  = ${caseParams.qt.symbol}`);
}

export function printPendlePrices(
  actualPrice: BigNumber,
  priceFromPendlePtLpOracle: BigNumber,
  priceFromSecondaryOracle: BigNumber,
  expectedPrice: BigNumber
) {
  const priceDelta = actualPrice.sub(expectedPrice);
  console.log(`  Price from PendlePtLpOracle: 1.0 PT  = ${ethers.utils.formatEther(priceFromPendlePtLpOracle)} SY`);
  console.log(`  Price from SecondaryOracle:  1.0 YQT = ${ethers.utils.formatEther(priceFromSecondaryOracle)} QT`);
  console.log(`  Final expected price:        1.0 PT  = ${ethers.utils.formatEther(expectedPrice)} QT`);
  console.log(`  Actual price from oracle:    1.0 PT  = ${ethers.utils.formatEther(actualPrice)} QT`);
  console.log(`  Delta: ${ethers.utils.formatEther(priceDelta)}`);
}

export async function fetchPendlePrices(
  params: PendleOracleCaseParams,
  blockTag?: number
): Promise<{
  actualBalancePrice: BigNumber;
  actualMargincallPrice: BigNumber;
  balancePtToSyPrice: BigNumber;
  margincallPtToSyPrice: BigNumber;
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
  const balancePtToSyPrice = await params.pendlePtLpOracle.getPtToSyRate(
    params.pendleMarket.address,
    params.secondsAgo,
    { blockTag }
  );
  const margincallPtToSyPrice = await params.pendlePtLpOracle.getPtToSyRate(
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
    balancePtToSyPrice,
    balancePriceFromSecondaryOracle,
    margincallPtToSyPrice,
    margincallPriceFromSecondaryOracle,
  };
}
