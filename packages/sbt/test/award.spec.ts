import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deploySbt } from './shared';
import { SBT__factory } from '../typechain-types';

describe('award()', function () {
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

  it('should require admin', async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);
    const user = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);

    await expect(user.award([], [], [])).to.be.rejectedWith(
      "Ownable: caller is not the owner",
    );
    await expect(admin.award([], [], [])).not.to.be.rejected;
  });

  it("should throw error when arguments mismatch length", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    await expect(admin.award([this.signers.users[0].address], [], [])).to.be.rejectedWith(
      "args invalid length",
    );
    await expect(admin.award([], [1], [])).to.be.rejectedWith(
      "args invalid length",
    );
    await expect(admin.award([], [], [1])).to.be.rejectedWith(
      "args invalid length",
    );
    await expect(admin.award([this.signers.users[0].address], [1], [])).to.be.rejectedWith(
      "args invalid length",
    );
    await expect(admin.award([], [1], [1])).to.be.rejectedWith(
      "args invalid length",
    );
    await expect(admin.award([this.signers.users[0].address], [1, 2], [1])).to.be.rejectedWith(
      "args invalid length",
    );
  });

  it("should throw error when awarding zero address", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    await expect(admin.award(["0x0000000000000000000000000000000000000000"], [1], [1])).to.be.rejectedWith(
      "address zero is not a valid owner",
    );
  });

  it("should throw error when amount is zero", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    await expect(admin.award([this.signers.users[0].address], [1], [0])).to.be.rejectedWith(
      "invalid amount",
    );
  });

  it("should award users and emit TransferSingle event", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    await expect(admin.award([this.signers.users[0].address, this.signers.users[1].address], [1, 2], [1, 2]))
      .to.emit(admin, "TransferSingle")
      .withArgs(this.signers.admin.address, "0x0000000000000000000000000000000000000000", this.signers.users[0].address, 1, 1)
      .to.emit(admin, "TransferSingle")
      .withArgs(this.signers.admin.address, "0x0000000000000000000000000000000000000000", this.signers.users[1].address, 2, 2);

    expect(await admin.balanceOf(this.signers.users[0].address, 1)).be.equal(1);
    expect(await admin.balanceOf(this.signers.users[1].address, 2)).be.equal(2);
  });
});
