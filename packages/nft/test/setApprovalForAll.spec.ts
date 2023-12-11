import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deployContestWinnerNft } from './shared';
import { ContestWinnerNFT__factory } from '../typechain-types';

describe('setApprovalForAll()', function () {
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

  it('should set approval', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);
    const user = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.users[0]);

    await user.setApprovalForAll(this.signers.admin.address, true);

    expect(await admin.isApprovedForAll(this.signers.users[0].address, this.signers.admin.address)).be.equal(true);

    await user.setApprovalForAll(this.signers.admin.address, false);

    expect(await admin.isApprovedForAll(this.signers.users[0].address, this.signers.admin.address)).be.equal(false);
  });
});
