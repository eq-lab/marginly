import { expect } from 'chai';
import { deploySBT, makeMintBurnCallParams, MintParam, SBTContractParams } from './shared';
import { ethers } from 'hardhat';
import { SBT } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';

describe('mint', () => {
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

  it('successful mint', async () => {
    const mintParams: MintParam[] = [
      { acc: signers[0].address, tokenId: 0, amount: 0 },
      { acc: signers[0].address, tokenId: 1, amount: 2 },
      { acc: signers[0].address, tokenId: 2, amount: 1 },
      { acc: signers[1].address, tokenId: 0, amount: 1 },
      { acc: signers[1].address, tokenId: 1, amount: 0 },
      { acc: signers[1].address, tokenId: 2, amount: 2 },
    ];

    const callParams = makeMintBurnCallParams(mintParams);

    await contract.mint(callParams.accounts, callParams.tokenIds);

    for (const { acc, tokenId, amount } of mintParams) {
      const balance = await contract.balanceOf(acc, BigNumber.from(tokenId));
      expect(balance.toNumber()).to.be.equal(amount);
    }
  });

  it('balanceOfBatch', async () => {
    const mintParams: MintParam[] = [
      { acc: signers[0].address, tokenId: 0, amount: 0 },
      { acc: signers[0].address, tokenId: 1, amount: 2 },
      { acc: signers[0].address, tokenId: 2, amount: 1 },
      { acc: signers[1].address, tokenId: 0, amount: 1 },
      { acc: signers[1].address, tokenId: 1, amount: 0 },
      { acc: signers[1].address, tokenId: 2, amount: 2 },
    ];

    const callParams = makeMintBurnCallParams(mintParams);

    await contract.mint(callParams.accounts, callParams.tokenIds);
    const balances = await contract.balanceOfBatch(
      mintParams.map((x) => x.acc),
      mintParams.map((x) => x.tokenId)
    );

    for (let i = 0; i < mintParams.length; i++) {
      const { amount } = mintParams[i];
      const balanceFromChain = balances[i].toNumber();
      expect(balanceFromChain).to.be.equal(amount);
    }
  });

  it('invalid array len', async () => {
    const mintParams: MintParam[] = [
      { acc: signers[0].address, tokenId: 0, amount: 0 },
      { acc: signers[0].address, tokenId: 1, amount: 2 },
      { acc: signers[0].address, tokenId: 2, amount: 1 },
      { acc: signers[1].address, tokenId: 0, amount: 1 },
      { acc: signers[1].address, tokenId: 1, amount: 0 },
      { acc: signers[1].address, tokenId: 2, amount: 2 },
    ];

    const callParams = makeMintBurnCallParams(mintParams);

    await expect(contract.mint(callParams.accounts, callParams.tokenIds.slice(1))).to.be.revertedWith(
      'invalid array len'
    );
  });

  it('user balance max cap', async () => {
    const mintParams: MintParam[] = [{ acc: signers[0].address, tokenId: 0, amount: 3 }];

    const callParams = makeMintBurnCallParams(mintParams);

    await expect(contract.mint(callParams.accounts, callParams.tokenIds)).to.be.revertedWith('user balance max cap');
  });

  it('not owner', async () => {
    const mintParams: MintParam[] = [{ acc: signers[1].address, tokenId: 1, amount: 1 }];

    const callParams = makeMintBurnCallParams(mintParams);

    await expect(contract.connect(signers[2]).mint(callParams.accounts, callParams.tokenIds)).to.be.revertedWith(
      'not owner'
    );
  });
});
