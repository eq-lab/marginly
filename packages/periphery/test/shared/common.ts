import { BigNumber } from 'ethers';
import bn from 'bignumber.js';
import { ethers } from 'hardhat';

export function toHumanPrice(priceX96: BigNumber, decimalsDiff: number) {
  const one = bn(2 ** 96);

  const multiplier = bn(10).pow(decimalsDiff);
  return bn(priceX96.toString()).times(multiplier).div(one.toString()).toString();
}

export function printPrices(balancePrice: BigNumber, mcPrice: BigNumber, decimalsDiff: number) {
  console.log(`Balance price is ${toHumanPrice(balancePrice, decimalsDiff)}  (${balancePrice})`);
  console.log(`MC price is ${toHumanPrice(mcPrice, decimalsDiff)} (${mcPrice})`);
}

export async function getDecimals(contractAddress: string): Promise<number> {
  const abi = ['function decimals() view returns (uint8)'];
  const contract = new ethers.Contract(contractAddress, abi, ethers.provider);
  return await contract.decimals();
}

export async function getDecimalsDiff(quoteToken: string, baseToken: string): Promise<number> {
  const baseDecimals = await getDecimals(baseToken);
  const quoteDecimals = await getDecimals(quoteToken);
  return baseDecimals - quoteDecimals;
}
