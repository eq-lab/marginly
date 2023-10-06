import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deploySbt } from './shared';
import { SBT__factory } from '../typechain-types';

describe('uri()', function () {
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

  it('should be empty by default', async function () {
    const user = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);

    expect(await user.uri(1)).be.equal("");
  });

  it('should return token uri after mint', async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    await admin.mint([1, 2], ["1", "2"]);

    expect(await admin.uri(1)).be.equal("1");
    expect(await admin.uri(2)).be.equal("2");
  });
});
