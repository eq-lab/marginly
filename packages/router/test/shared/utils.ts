import { BigNumber, ContractTransaction } from 'ethers';
import { ERC20 } from '../../typechain-types';
import { formatUnits } from 'ethers/lib/utils';

export const SWAP_ONE = 1 << 15;

export const Dex = {
  UniswapV3: 0,
  ApeSwap: 1,
  Balancer: 2,
  Camelot: 3,
  KyberClassicSwap: 4,
  KyberElasticSwap: 5,
  QuickSwap: 6,
  SushiSwap: 7,
  TraderJoe: 8,
  Woofi: 9,
  Ramses: 10,
  DodoV1: 11,
  DodoV2: 12,
  Curve: 13,
  Pendle: 17,
  PendleMarket: 19,
  PendleCurveRouter: 20,
  PendleCurve: 21,
};

export function constructSwap(dex: number[], ratios: number[]): BigNumber {
  if (dex.length != ratios.length) {
    throw new Error(`dex and ratios arrays length are different`);
  }

  let swap = BigInt(0);
  for (let i = 0; i < dex.length; ++i) {
    swap = (((swap << BigInt(6)) + BigInt(dex[i])) << BigInt(16)) + BigInt(ratios[i]);
  }
  swap = (swap << BigInt(4)) + BigInt(dex.length);
  return BigNumber.from(swap);
}

export async function showGasUsage(tx: ContractTransaction) {
  const txReceipt = await tx.wait();
  console.log(`⛽ gas used ${txReceipt.gasUsed}`);
}

export async function showBalance(token: ERC20, account: string, startPhrase = ''): Promise<BigNumber> {
  const [balance, symbol, decimals] = await Promise.all([token.balanceOf(account), token.symbol(), token.decimals()]);

  console.log(`${startPhrase} ${formatUnits(balance, decimals)} ${symbol}`);
  return balance;
}
