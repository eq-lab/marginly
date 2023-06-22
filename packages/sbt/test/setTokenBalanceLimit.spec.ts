import { expect } from 'chai';
import { deploySBT, SBTContractParams } from './shared';
import { ethers } from 'hardhat';
import { SBT } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('setTokenBalanceLimit', () => {
  let params: SBTContractParams;
  let contract: SBT;
  let owner: SignerWithAddress;
  let signers: SignerWithAddress[];

  beforeEach(async () => {
    owner = (await ethers.getSigners())[0];
    signers = (await ethers.getSigners()).slice(1);
    params = {
      owner,
      tokens: [
        { id: 0, uri: 'Token0', maxAmount: 2 },
        { id: 1, uri: 'Token1', maxAmount: 2 },
        { id: 2, uri: 'Token2', maxAmount: 2 },
      ],
    };
    contract = await deploySBT(params);
  });

  it('successful set', async () => {
    const tokenId = 2;
    const newMax = 6;
    await contract.setTokenBalanceLimit(tokenId, newMax);

    const balanceLimit = await contract._tokenBalanceLimits(tokenId);
    expect(balanceLimit.toNumber()).to.be.equal(newMax);
  });

  it('not owner', async () => {
    await expect(contract.connect(signers[2]).setTokenBalanceLimit(1, 1)).to.be.revertedWith('not owner');
  });
});
