import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deploySbt } from './shared';
import { SBT__factory } from '../typechain-types';

describe('safeBatchTransferFrom()', function () {
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

  it('should throw error', async function () {
    const user = SBT__factory.connect(await this.sbt.getAddress(), this.signers.users[0]);

    await expect(user.safeBatchTransferFrom(this.signers.users[0].address, this.signers.users[1].address, [1], [1], "0x")).to.be.rejectedWith(
      "invalid operation",
    );
  });
});
