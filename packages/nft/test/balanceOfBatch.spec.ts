import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deployContestWinnerNft } from './shared';
import { ContestWinnerNFT__factory } from '../typechain-types';

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
    const { contract } = await this.loadFixture(deployContestWinnerNft);
    this.contestWinnerNft = contract;
  });

  it('should be zero by default', async function () {
    const user = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.users[0]);

    const balances = await user.balanceOfBatch([this.signers.users[0].address, this.signers.users[1].address], [1, 2]);

    expect(balances[0]).to.equal(0);
    expect(balances[1]).to.equal(0);
  });

  it('should throw error when arguments mismatch length', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);

    await expect(admin.balanceOfBatch([this.signers.users[0].address], [])).to.be.rejectedWith(
      'ERC1155: accounts and ids length mismatch'
    );
    await expect(admin.balanceOfBatch([], [1])).to.be.rejectedWith('ERC1155: accounts and ids length mismatch');
    await expect(admin.balanceOfBatch([this.signers.users[0].address], [1, 2])).to.be.rejectedWith(
      'ERC1155: accounts and ids length mismatch'
    );
    await expect(
      admin.balanceOfBatch([this.signers.users[0].address, this.signers.users[1].address], [1])
    ).to.be.rejectedWith('ERC1155: accounts and ids length mismatch');
  });

  it('should be increased after award', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);
    const user = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.users[0]);

    await admin.mint([this.signers.users[0].address], [1], [123]);
    await admin.mint([this.signers.users[1].address], [2], [456]);

    const balances = await user.balanceOfBatch([this.signers.users[0].address, this.signers.users[1].address], [1, 2]);

    expect(balances[0]).be.equal(123);
    expect(balances[1]).be.equal(456);
  });

  it('should be decreased after award', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);
    const user1 = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.users[0]);
    const user2 = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.users[1]);

    await admin.mint([this.signers.users[0].address], [1], [123]);
    await admin.mint([this.signers.users[1].address], [2], [456]);
    await user1.burn(this.signers.users[0].address, 1, 23);
    await user2.burn(this.signers.users[1].address, 2, 56);

    const balances = await admin.balanceOfBatch([this.signers.users[0].address, this.signers.users[1].address], [1, 2]);

    expect(balances[0]).be.equal(100);
    expect(balances[1]).be.equal(400);
  });
});
