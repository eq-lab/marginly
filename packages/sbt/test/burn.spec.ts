import { expect } from 'chai';
import { deploySBT, MintBurnParam, SBTContractParams } from './shared';
import { ethers } from 'hardhat';
import { SBT } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';

describe('burn', () => {
  let params: SBTContractParams;
  let contract: SBT;
  let owner: SignerWithAddress;
  let signers: SignerWithAddress[];
  let mintParams: MintBurnParam[];

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

    mintParams = [
      { acc: signers[0].address, tokenId: 1, amount: 2 },
      { acc: signers[0].address, tokenId: 2, amount: 1 },
      { acc: signers[1].address, tokenId: 0, amount: 1 },
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

  it('successful burn', async () => {
    const burnParams: MintBurnParam[] = [
      { acc: signers[0].address, tokenId: 1, amount: 1 },
      { acc: signers[0].address, tokenId: 2, amount: 1 },
      { acc: signers[1].address, tokenId: 2, amount: 2 },
    ];

    await contract.burn(
      burnParams.map((x) => x.acc),
      burnParams.map((x) => x.tokenId),
      burnParams.map((x) => x.amount)
    );

    for (const burnParam of burnParams) {
      const mintParam = mintParams.find((x) => x.acc === burnParam.acc && x.tokenId === burnParam.tokenId)!;
      const expectedBalance = mintParam.amount - burnParam.amount;
      const balance = await contract.balanceOf(burnParam.acc, BigNumber.from(burnParam.tokenId));
      expect(balance.toNumber()).to.be.equal(expectedBalance);
    }
  });

  it('invalid array len', async () => {
    await expect(
      contract.burn(
        mintParams.map((x) => x.acc),
        mintParams.map((x) => x.tokenId).slice(1),
        mintParams.map((x) => x.amount)
      )
    ).to.be.revertedWith('invalid array len');
  });

  it('invalid array len 2', async () => {
    await expect(
      contract.burn(
        mintParams.map((x) => x.acc),
        mintParams.map((x) => x.tokenId),
        mintParams.map((x) => x.amount).slice(1)
      )
    ).to.be.revertedWith('invalid array len');
  });

  it('burn amount > balance', async () => {
    const burnParams: MintBurnParam[] = [{ acc: signers[0].address, tokenId: 1, amount: 3 }];
    await expect(
      contract.burn(
        burnParams.map((x) => x.acc),
        burnParams.map((x) => x.tokenId),
        burnParams.map((x) => x.amount)
      )
    ).to.be.revertedWith('burn amount > balance');
  });

  it('zero amount', async () => {
    const burnParams: MintBurnParam[] = [{ acc: signers[0].address, tokenId: 1, amount: 0 }];
    await expect(
      contract.burn(
        burnParams.map((x) => x.acc),
        burnParams.map((x) => x.tokenId),
        burnParams.map((x) => x.amount)
      )
    ).to.be.revertedWith('zero amount');
  });

  it('not owner', async () => {
    const burnParams: MintBurnParam[] = [{ acc: signers[1].address, tokenId: 2, amount: 1 }];
    await expect(
      contract.connect(signers[2]).burn(
        burnParams.map((x) => x.acc),
        burnParams.map((x) => x.tokenId),
        burnParams.map((x) => x.amount)
      )
    ).to.be.revertedWith('not owner');
  });
});
