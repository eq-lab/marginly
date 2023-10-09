import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deploySbt } from './shared';
import { SBT__factory } from '../typechain-types';

describe('renounceOwnership()', function () {
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

    await expect(user.renounceOwnership()).to.be.rejectedWith(
      "Ownable: caller is not the owner",
    );
    await expect(admin.renounceOwnership()).not.to.be.rejected;
  });

  it("should leave account without owner and emit OwnershipTransferred event", async function () {
    const admin = SBT__factory.connect(await this.sbt.getAddress(), this.signers.admin);

    await expect(admin.renounceOwnership())
      .to.emit(admin, "OwnershipTransferred")
      .withArgs(this.signers.admin.address, "0x0000000000000000000000000000000000000000");

    expect(await admin.owner()).be.equal("0x0000000000000000000000000000000000000000");
  });
});
