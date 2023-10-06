import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deploySbt } from './shared';
import { SBT__factory } from '../typechain-types';

describe('burn()', function () {
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

  it('should require owner', async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);
    const owner = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);
    const user = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[1]);

    admin.award([this.signers.users[0].address], [1], [100]);

    await expect(admin.burn(1, 1)).to.be.rejectedWith(
      "burn amount exceeds balance",
    );
    await expect(user.burn(1, 1)).to.be.rejectedWith(
      "burn amount exceeds balance",
    );
    await expect(owner.burn(1, 1)).not.to.be.rejected;
  });

  it("should throw error when amount is zero", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);
    const owner = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);

    admin.award([this.signers.users[0].address], [1], [100]);

    await expect(owner.burn(1, 0)).to.be.rejectedWith(
      "invalid amount",
    );
  });

  it("should throw error when amount exceeds balance", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);
    const owner = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);

    admin.award([this.signers.users[0].address], [1], [100]);

    await expect(owner.burn(1, 99)).not.to.be.rejected;
    await expect(owner.burn(1, 2)).to.be.rejectedWith(
      "burn amount exceeds balance"
    );
  });

  it("should burn the specified amount of token and emit TransferSingle event", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);
    const owner = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);

    admin.award([this.signers.users[0].address], [1], [100]);

    await expect(owner.burn(1, 99))
      .to.emit(admin, "TransferSingle")
      .withArgs(this.signers.users[0].address, this.signers.users[0].address, "0x0000000000000000000000000000000000000000", 1, 99);

    expect(await owner.balanceOf(this.signers.users[0].address, 1)).be.equal(1);
  });
});
