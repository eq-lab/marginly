import { BigNumber } from "ethers";

export const Dex = {
  UniswapV3: 0,
  ApeSwap: 1,
  Balancer: 2,
  Camelot: 3,
  KyberSwap: 4,
  QuickSwap: 5,
  SushiSwap: 6,
  TraderJoe: 7,
  Woofi: 8,
};

export function constructSwap(dex: number[], ratios: number[]): BigNumber {
  if (dex.length != ratios.length) {
    throw new Error(`dex and ratios arrays length are different`);
  }

  let swap = BigInt(0);
  for(let i = 0; i < dex.length; ++i) {
    swap = (((swap + BigInt(dex[i])) << BigInt(16)) + BigInt(ratios[i])) << BigInt(4);
  }
  swap += BigInt(dex.length);
  return BigNumber.from(swap);
}