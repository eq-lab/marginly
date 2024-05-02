import { BigNumber } from 'ethers';

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
  Pendle: 14,
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
