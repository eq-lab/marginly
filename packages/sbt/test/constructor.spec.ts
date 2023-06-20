import { expect } from 'chai';
import { deploySBT, deploySBTWithParams, SBTContractParams } from './shared';
import { ethers } from 'hardhat';

describe('constructor', () => {
  it('should deploy', async () => {
    const owner = (await ethers.getSigners())[0];
    const params: SBTContractParams = {
      owner,
      tokens: [
        { id: 1, uri: 'Token1', maxAmount: 2 },
        { id: 2, uri: 'Token2', maxAmount: 2 },
      ],
    };
    const contract = await deploySBT(params);
    const ownerFromContract = await contract._owner();
    expect(ownerFromContract.toLowerCase()).to.be.equal(owner.address.toLowerCase());

    for (const token of params.tokens) {
      const maxFromContract = await contract._tokenBalanceLimits(token.id);
      const uriFromContract = await contract.uri(token.id);
      expect(maxFromContract.toNumber()).to.be.equal(token.maxAmount);
      expect(uriFromContract.toLowerCase()).to.be.equal(token.uri.toLowerCase());
    }
  });

  it('tokenBalanceLimits invalid len', async () => {
    const ids = [1, 2];
    const maxAmounts = [2];
    const uris = ['Token1', 'Token2'];
    await expect(deploySBTWithParams(ids, maxAmounts, uris)).to.be.revertedWith('tokenBalanceLimits invalid len');
  });

  it('uri invalid len', async () => {
    const ids = [1, 2];
    const maxAmounts = [2, 2];
    const uris = ['Token1'];
    await expect(deploySBTWithParams(ids, maxAmounts, uris)).to.be.revertedWith('uri invalid len');
  });

  it('zero id', async () => {
    const owner = (await ethers.getSigners())[0];
    const params: SBTContractParams = {
      owner,
      tokens: [
        { id: 0, uri: 'Token1', maxAmount: 2 },
        { id: 1, uri: 'Token2', maxAmount: 2 },
      ],
    };

    await expect(deploySBT(params)).to.be.revertedWith('zero id');
  });

  it('id duplicate', async () => {
    const owner = (await ethers.getSigners())[0];
    const params: SBTContractParams = {
      owner,
      tokens: [
        { id: 1, uri: 'Token1', maxAmount: 2 },
        { id: 1, uri: 'Token2', maxAmount: 2 },
      ],
    };

    await expect(deploySBT(params)).to.be.revertedWith('id duplicate');
  });
});
