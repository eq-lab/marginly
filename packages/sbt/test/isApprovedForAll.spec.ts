import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deploySbt } from './shared';
import { SBT__factory } from '../typechain-types';

describe('isApprovedForAll()', function () {
  before(async function () {
    const signers = await ethers.getSigners();

    this.signers = {
      admin: signers[0],
      users: signers.splice(1),
    } as Signers;

    this.loadFixture = loadFixture;
  });

  beforeEach(async function () {
    const { contract } = await this.loadFixture(deploySbt);
    this.sbt = contract;
  });

  it('should return false', async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    expect(await admin.isApprovedForAll(this.signers.users[0].address, this.signers.users[0].address)).be.equal(false);
  });
});
