import { expect } from 'chai';
import { deploySBT, SBTContractParams } from './shared';
import { ethers } from 'hardhat';
import { SBT } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('createTokens', () => {
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
    const tokensCount = await contract._tokensCount();
    expect(tokensCount).to.be.equal(params.tokens.length);
  });

  it('successful creation', async () => {
    const increment = 1;
    const tokenId = params.tokens.length;
    const newUri = 'newToken';

    await contract.createTokens(increment);
    const tokensCount = await contract._tokensCount();
    expect(tokensCount).to.be.equal(tokenId + increment);

    await contract.setURI(tokenId, newUri);

    const uri = await contract.uri(tokenId);
    expect(newUri).to.be.equal(uri);
  });

  it('not owner', async () => {
    await expect(contract.connect(signers[2]).createTokens(1)).to.be.revertedWith('not owner');
  });
});
