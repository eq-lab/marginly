import * as ethers from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';

export function formatBalance(amount: BigNumber, decimals: number, assetSymbol: string): string {
  return `${amount} (${ethers.utils.formatUnits(amount, decimals)} ${assetSymbol.toUpperCase()})`;
}

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const waitForTx = async (provider: ethers.providers.Provider, hash: string) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) {
      await sleep(3000);
    } else {
      if (!receipt.status) {
        throw new Error('Transaction failed');
      }
      break;
    }
  }
};
