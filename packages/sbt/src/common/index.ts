import { BigNumber, ethers } from 'ethers';

export const sbtContractName = 'SBT';

export interface SbtDeployment {
  address: string;
  tokens: TokenInfo[];
  owner: string;
}

export interface TokenInfo {
  id: number;
  uri: string;
  tokenBalanceLimit: number;
}

export interface SbtBalance {
  address: string;
  tokenId: number;
  amount: number;
}

export function assertSbtBalances(balances: SbtBalance[], tokens: TokenInfo[]) {
  if (balances.length === 0) {
    return;
  }
  if (tokens.length === 0) {
    throw new Error(`Config contains balances, but not contains tokens info.`);
  }
  for (const balance of balances) {
    if (!ethers.utils.isAddress(balance.address)) {
      throw new Error(`Address field not a valid eth address. Address: ${balance.address}`);
    }
    const duplicates = balances.filter(
      (x) => x.address.toLowerCase() === balance.address.toLowerCase() && x.tokenId === balance.tokenId
    );
    if (duplicates.length > 1) {
      throw new Error(`There are duplicates in balances. Address: ${balance.address}, tokenId: ${balance.tokenId}`);
    }
    const token = tokens.find((x) => x.id === balance.tokenId);
    if (token === undefined) {
      throw new Error(`Found balance with unknown token. Address: ${balance.address}, tokenId: ${balance.tokenId}`);
    }

    if (balance.amount > token.tokenBalanceLimit) {
      throw new Error(
        `Balance exceeds the limit. ` +
          `Address: ${balance.address}, tokenId: ${balance.tokenId}, ` +
          `balance: ${balance.amount}, limit: ${token.tokenBalanceLimit}`
      );
    }
  }
}

export async function balanceOfBatch(sbtContract: ethers.Contract, addresses: string[], tokenIds: number[]) {
  return ((await sbtContract.balanceOfBatch(addresses, tokenIds)) as BigNumber[]).map((x) => x.toNumber());
}

export async function assertSignerHasOwnerRights(signer: ethers.Signer, sbtContract: ethers.Contract) {
  const currentOwner = (await sbtContract._owner()).toString();
  if ((await signer.getAddress()).toLowerCase() !== currentOwner.toLowerCase()) {
    throw new Error(`Signer has no owner right! Owner address: ${currentOwner}`);
  }
}
