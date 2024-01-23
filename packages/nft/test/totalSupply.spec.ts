import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deployContestWinnerNft } from './shared';
import { ContestWinnerNFT__factory } from '../typechain-types';

describe('totalSupply()', function () {
  before(async function () {
    const signers = await ethers.getSigners();

    this.signers = {
      admin: signers[0],
      users: signers.splice(1),
    } as Signers;

    this.loadFixture = loadFixture;
  });

  beforeEach(async function () {
    const { contract } = await this.loadFixture(deployContestWinnerNft);
    this.contestWinnerNft = contract;
  });

  it('should return total supply of token', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);
    const user = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.users[0]);

    await admin.mint([this.signers.users[0].address], [1], [123]);
    await user.setApprovalForAll(this.signers.admin.address, true);
    await admin.safeTransferFrom(this.signers.users[0].address, this.signers.users[1].address, 1, 23, '0x');

    expect(await user.balanceOf(this.signers.users[0].address, 1)).be.equal(100);
    expect(await user.balanceOf(this.signers.users[1].address, 1)).be.equal(23);
    expect(await user.totalSupply(1)).be.equal(123);
  });
});
