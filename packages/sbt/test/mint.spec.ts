import { expect } from 'chai';
import { deploySBT, MintBurnParam, SBTContractParams } from './shared';
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
    const mintParams: MintBurnParam[] = [
      { acc: signers[0].address, tokenId: 1, amount: 2 },
      { acc: signers[0].address, tokenId: 2, amount: 1 },
      { acc: signers[1].address, tokenId: 2, amount: 2 },
    ];

    await contract.mint(
      mintParams.map((x) => x.acc),
      mintParams.map((x) => x.tokenId),
      mintParams.map((x) => x.amount)
    );

    for (const { acc, tokenId, amount } of mintParams) {
      const balance = await contract.balanceOf(acc, BigNumber.from(tokenId));
      expect(balance.toNumber()).to.be.equal(amount);
    }
  });

  it('balanceOfBatch', async () => {
    const mintParams: MintBurnParam[] = [
      { acc: signers[0].address, tokenId: 1, amount: 2 },
      { acc: signers[0].address, tokenId: 2, amount: 1 },
      { acc: signers[1].address, tokenId: 2, amount: 2 },
    ];

    await contract.mint(
      mintParams.map((x) => x.acc),
      mintParams.map((x) => x.tokenId),
      mintParams.map((x) => x.amount)
    );
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

  it('invalid array len 1', async () => {
    const mintParams: MintBurnParam[] = [
      { acc: signers[0].address, tokenId: 1, amount: 2 },
      { acc: signers[0].address, tokenId: 2, amount: 1 },
      { acc: signers[1].address, tokenId: 2, amount: 2 },
    ];

    await expect(
      contract.mint(
        mintParams.map((x) => x.acc),
        mintParams.map((x) => x.tokenId).slice(1),
        mintParams.map((x) => x.amount)
      )
    ).to.be.revertedWith('invalid array len');
  });

  it('invalid array len 2', async () => {
    const mintParams: MintBurnParam[] = [
      { acc: signers[0].address, tokenId: 1, amount: 2 },
      { acc: signers[0].address, tokenId: 2, amount: 1 },
      { acc: signers[1].address, tokenId: 0, amount: 1 },
      { acc: signers[1].address, tokenId: 2, amount: 2 },
    ];

    await expect(
      contract.mint(
        mintParams.map((x) => x.acc),
        mintParams.map((x) => x.tokenId),
        mintParams.map((x) => x.amount).slice(1)
      )
    ).to.be.revertedWith('invalid array len');
  });

  it('user balance max cap', async () => {
    const mintParams: MintBurnParam[] = [{ acc: signers[0].address, tokenId: 0, amount: 3 }];

    await expect(
      contract.mint(
        mintParams.map((x) => x.acc),
        mintParams.map((x) => x.tokenId),
        mintParams.map((x) => x.amount)
      )
    ).to.be.revertedWith('user balance max cap');
  });

  it('zero amount', async () => {
    const mintParams: MintBurnParam[] = [{ acc: signers[0].address, tokenId: 1, amount: 0 }];
    await expect(
      contract.burn(
        mintParams.map((x) => x.acc),
        mintParams.map((x) => x.tokenId),
        mintParams.map((x) => x.amount)
      )
    ).to.be.revertedWith('zero amount');
  });

  it('not owner', async () => {
    const mintParams: MintBurnParam[] = [{ acc: signers[1].address, tokenId: 1, amount: 1 }];

    await expect(
      contract.connect(signers[2]).mint(
        mintParams.map((x) => x.acc),
        mintParams.map((x) => x.tokenId),
        mintParams.map((x) => x.amount)
      )
    ).to.be.revertedWith('not owner');
  });
});
