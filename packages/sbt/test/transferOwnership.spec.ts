import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deploySbt } from './shared';
import { SBT__factory } from '../typechain-types';

describe('transferOwnership()', function () {
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

    await expect(user.transferOwnership(this.signers.users[1].address)).to.be.rejectedWith(
      "Ownable: caller is not the owner",
    );
    await expect(admin.transferOwnership(this.signers.users[0].address)).not.to.be.rejected;
  });

  it('should transfer ownership', async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    const tx = await admin.transferOwnership(this.signers.users[0].address);
    await tx.wait();
    const owner = await admin.owner();

    expect(owner).to.equal(this.signers.users[0].address);
  });

  it("should throw an error when zero address was specified", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    await expect(admin.transferOwnership("0x0000000000000000000000000000000000000000")).to.be.rejectedWith(
      "Ownable: new owner is the zero address",
    );
  });
});
