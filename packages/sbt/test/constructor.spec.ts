import { expect } from 'chai';
import { deploySBT, deploySBTWithParams, SBTContractParams } from './shared';
import { ethers } from 'hardhat';

describe('constructor', () => {
  it('should deploy', async () => {
    const owner = (await ethers.getSigners())[0];
    const params: SBTContractParams = {
      owner,
      tokens: [
        { id: 0, uri: 'Token0', maxAmount: 2 },
        { id: 1, uri: 'Token1', maxAmount: 2 },
      ],
    };
    const contract = await deploySBT(params);
    const ownerFromContract = await contract._owner();
    expect(ownerFromContract.toLowerCase()).to.be.equal(owner.address.toLowerCase());

    const tokensCount = await contract._tokensCount();
    expect(tokensCount.toNumber()).to.be.equal(params.tokens.length);

    for (const token of params.tokens) {
      const maxFromContract = await contract._tokenBalanceLimits(token.id);
      const uriFromContract = await contract.uri(token.id);
      expect(maxFromContract.toNumber()).to.be.equal(token.maxAmount);
      expect(uriFromContract.toLowerCase()).to.be.equal(token.uri.toLowerCase());
    }
  });

  it('empty arrays as args', async () => {
    const owner = (await ethers.getSigners())[0];
    const params: SBTContractParams = {
      owner,
      tokens: [],
    };
    const contract = await deploySBT(params);
    const ownerFromContract = await contract._owner();
    expect(ownerFromContract.toLowerCase()).to.be.equal(owner.address.toLowerCase());

    const tokensCount = await contract._tokensCount();
    expect(tokensCount.toNumber()).to.be.equal(0);
  });

  it('uri invalid len', async () => {
    const maxAmounts = [2, 2];
    const uris = ['Token1'];
    await expect(deploySBTWithParams(maxAmounts, uris)).to.be.revertedWith('uri invalid len');
  });
});
