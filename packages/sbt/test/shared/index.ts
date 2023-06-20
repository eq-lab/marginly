import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { SBT } from '../../typechain-types';

export interface TokenInfo {
  id: number;
  uri: string;
  maxAmount: number;
}

export interface SBTContractParams {
  owner: SignerWithAddress;
  tokens: TokenInfo[];
}

export async function deploySBT(params: SBTContractParams): Promise<SBT> {
  const SBTFactory = await ethers.getContractFactory('SBT');
  return await SBTFactory.deploy(
    params.tokens.map((x) => x.id),
    params.tokens.map((x) => x.maxAmount),
    params.tokens.map((x) => x.uri)
  );
}

export async function deploySBTWithParams(
  ids: number[],
  maxAmounts: number[],
  uris: string[]
): Promise<{ contract: SBT; owner: SignerWithAddress }> {
  const SBTFactory = await ethers.getContractFactory('SBT');
  const [owner] = await ethers.getSigners();
  return {
    contract: await SBTFactory.deploy(ids, maxAmounts, uris),
    owner,
  };
}

export interface MintParam {
  acc: string;
  tokenId: number;
  amount: number;
}

export function makeMintBurnCallParams(params: MintParam[]): {
  accounts: string[];
  tokenIds: number[];
} {
  const accounts: string[] = [];
  const tokenIds: number[] = [];

  for (const { acc, tokenId, amount } of params) {
    for (let i = 0; i < amount; i++) {
      accounts.push(acc);
      tokenIds.push(tokenId);
    }
  }
  return { accounts, tokenIds };
}
