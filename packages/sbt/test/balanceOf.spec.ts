import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deploySbt } from './shared';
import { SBT__factory } from '../typechain-types';

describe('balanceOf()', function () {
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

  it('should be zero by default', async function () {
    const user = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);

    expect(await user.balanceOf(this.signers.users[0].address, 1)).be.equal(0);
  });

  it('should be increased after award', async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);
    const user = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);

    await admin.mint([this.signers.users[0].address], [1], [123]);

    expect(await user.balanceOf(this.signers.users[0].address, 1)).be.equal(123);
  });

  it('should be decreased after award', async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);
    const user = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);

    await admin.mint([this.signers.users[0].address], [1], [123]);
    await user.burn(1, 23);

    expect(await user.balanceOf(this.signers.users[0].address, 1)).be.equal(100);
  });
});
