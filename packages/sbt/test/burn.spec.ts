import { expect } from 'chai';
import { deploySBT, makeMintBurnCallParams, MintParam, SBTContractParams } from './shared';
import { ethers } from 'hardhat';
import { SBT } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';

describe('burn', () => {
  let params: SBTContractParams;
  let contract: SBT;
  let owner: SignerWithAddress;
  let signers: SignerWithAddress[];
  let mintParams: MintParam[];

  beforeEach(async () => {
    owner = (await ethers.getSigners())[0];
    signers = (await ethers.getSigners()).slice(1);
    params = {
      owner,
      tokens: [
        { id: 1, uri: 'Token1', maxAmount: 2 },
        { id: 2, uri: 'Token2', maxAmount: 2 },
        { id: 3, uri: 'Token3', maxAmount: 2 },
      ],
    };
    contract = await deploySBT(params);

    mintParams = [
      { acc: signers[0].address, tokenId: 1, amount: 0 },
      { acc: signers[0].address, tokenId: 2, amount: 2 },
      { acc: signers[0].address, tokenId: 3, amount: 1 },
      { acc: signers[1].address, tokenId: 1, amount: 1 },
      { acc: signers[1].address, tokenId: 2, amount: 0 },
      { acc: signers[1].address, tokenId: 3, amount: 2 },
    ];

    const callParams = makeMintBurnCallParams(mintParams);

    await contract.mint(callParams.accounts, callParams.tokenIds);

    for (const { acc, tokenId, amount } of mintParams) {
      const balance = await contract.balanceOf(acc, BigNumber.from(tokenId));
      expect(balance.toNumber()).to.be.equal(amount);
    }
  });

  it('successful burn', async () => {
    const burnParams: MintParam[] = [
      { acc: signers[0].address, tokenId: 1, amount: 0 },
      { acc: signers[0].address, tokenId: 2, amount: 1 },
      { acc: signers[0].address, tokenId: 3, amount: 1 },
      { acc: signers[1].address, tokenId: 1, amount: 0 },
      { acc: signers[1].address, tokenId: 2, amount: 0 },
      { acc: signers[1].address, tokenId: 3, amount: 2 },
    ];

    const callParams = makeMintBurnCallParams(burnParams);

    await contract.burn(callParams.accounts, callParams.tokenIds);

    for (let i = 0; i < mintParams.length; i++) {
      const acc = mintParams[i].acc;
      const tokenId = mintParams[i].tokenId;
      const expectedBalance = mintParams[i].amount - burnParams[i].amount;
      const balance = await contract.balanceOf(acc, BigNumber.from(tokenId));

      expect(balance.toNumber()).to.be.equal(expectedBalance);
    }
  });

  it('invalid array len', async () => {
    const callParams = makeMintBurnCallParams(mintParams);

    await expect(contract.burn(callParams.accounts, callParams.tokenIds.slice(1))).to.be.revertedWith(
      'invalid array len'
    );
  });

  it('empty balance', async () => {
    const burnParams: MintParam[] = [{ acc: signers[0].address, tokenId: 1, amount: 3 }];

    const callParams = makeMintBurnCallParams(burnParams);

    await expect(contract.burn(callParams.accounts, callParams.tokenIds)).to.be.revertedWith('empty balance');
  });

  it('not owner', async () => {
    const burnParams: MintParam[] = [{ acc: signers[1].address, tokenId: 2, amount: 1 }];

    const callParams = makeMintBurnCallParams(burnParams);

    await expect(contract.connect(signers[2]).burn(callParams.accounts, callParams.tokenIds)).to.be.revertedWith(
      'not owner'
    );
  });
});
