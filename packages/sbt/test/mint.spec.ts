import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deploySbt } from './shared';
import { SBT__factory } from '../typechain-types';

describe('mint()', function () {
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
    const user = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);

    await expect(user.mint([], [])).to.be.rejectedWith(
      "Ownable: caller is not the owner",
    );
    await expect(admin.mint([], [])).not.to.be.rejected;
  });

  it("should throw error when arguments mismatch length", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    await expect(admin.mint([], [""])).to.be.rejectedWith(
      "args invalid length",
    );
    await expect(admin.mint([1], [])).to.be.rejectedWith(
      "args invalid length",
    );
    await expect(admin.mint([1], ["", ""])).to.be.rejectedWith(
      "args invalid length",
    );
    await expect(admin.mint([1, 2], [""])).to.be.rejectedWith(
      "args invalid length",
    );
  });

  it("should throw error when uri is empty", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    await expect(admin.mint([1], [""])).to.be.rejectedWith(
      "invalid uri",
    );
  });

  it("should mint tokens, set uris and emit URI event", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    await expect(admin.mint([1, 2, 3], ["1", "2", "3"]))
      .to.emit(admin, "URI")
      .withArgs("1", 1)
      .to.emit(admin, "URI")
      .withArgs("2", 2)
      .to.emit(admin, "URI")
      .withArgs("3", 3);

    expect(await admin.uri(1)).be.equal("1");
    expect(await admin.uri(2)).be.equal("2");
    expect(await admin.uri(3)).be.equal("3");
  });
});
