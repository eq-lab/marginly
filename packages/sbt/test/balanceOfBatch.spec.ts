import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deploySbt } from './shared';
import { SBT__factory } from '../typechain-types';

describe('balanceOfBatch()', function () {
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

    const balances = await user.balanceOfBatch([this.signers.users[0].address, this.signers.users[1].address], [1, 2]);

    expect(balances[0]).to.equal(0);
    expect(balances[1]).to.equal(0);
  });

  it("should throw error when arguments mismatch length", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    await expect(admin.balanceOfBatch([this.signers.users[0].address], [])).to.be.rejectedWith(
      "args invalid length",
    );
    await expect(admin.balanceOfBatch([], [1])).to.be.rejectedWith(
      "args invalid length",
    );
    await expect(admin.balanceOfBatch([this.signers.users[0].address], [1, 2])).to.be.rejectedWith(
      "args invalid length",
    );
    await expect(admin.balanceOfBatch([this.signers.users[0].address, this.signers.users[1].address], [1])).to.be.rejectedWith(
      "args invalid length",
    );
  });

  it('should be increased after award', async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);
    const user = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);

    await admin.award([this.signers.users[0].address], [1], [123]);
    await admin.award([this.signers.users[1].address], [2], [456]);

    const balances = await user.balanceOfBatch([this.signers.users[0].address, this.signers.users[1].address], [1, 2]);

    expect(balances[0]).be.equal(123);
    expect(balances[1]).be.equal(456);
  });

  it('should be decreased after award', async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);
    const user1 = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);
    const user2 = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[1]);

    await admin.award([this.signers.users[0].address], [1], [123]);
    await admin.award([this.signers.users[1].address], [2], [456]);
    await user1.burn(1, 23);
    await user2.burn(2, 56);

    const balances = await admin.balanceOfBatch([this.signers.users[0].address, this.signers.users[1].address], [1, 2]);

    expect(balances[0]).be.equal(100);
    expect(balances[1]).be.equal(400);
  });
});
