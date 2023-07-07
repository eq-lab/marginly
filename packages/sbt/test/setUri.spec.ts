import { expect } from 'chai';
import { deploySBT, SBTContractParams } from './shared';
import { ethers } from 'hardhat';
import { SBT } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('setURI', () => {
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
    const newUri = 'newToken2';
    await contract.setURI(tokenId, newUri);

    const uri = await contract.uri(tokenId);
    expect(newUri).to.be.equal(uri);
  });

  it('not owner', async () => {
    await expect(contract.connect(signers[2]).setURI(0, 'newToken0')).to.be.revertedWith('not owner');
  });

  it('id too high', async () => {
    const tokenId = params.tokens.length;
    const newUri = 'newToken20';

    await expect(contract.setURI(tokenId, newUri)).to.be.revertedWith('id too high');
  });
});
