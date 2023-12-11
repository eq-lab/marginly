import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deployContestWinnerNft } from './shared';
import { ContestWinnerNFT__factory } from '../typechain-types';

describe('burnMinted()', function () {
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

  it('should require owner', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);
    const user = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.users[0]);

    admin.mint([this.signers.users[0].address, this.signers.users[1].address], [1, 2], [1, 2]);

    await expect(user.burnMinted([this.signers.users[0].address], [1], [1])).to.be.rejectedWith(
      'Ownable: caller is not the owner'
    );
    await expect(admin.burnMinted([this.signers.users[0].address], [1], [1])).not.to.be.rejected;
  });

  it('should throw error when arguments mismatch length', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);

    await expect(admin.burnMinted([this.signers.users[0].address], [], [])).to.be.rejectedWith('args invalid length');
    await expect(admin.burnMinted([], [1], [])).to.be.rejectedWith('args invalid length');
    await expect(admin.burnMinted([], [], [1])).to.be.rejectedWith('args invalid length');
    await expect(admin.burnMinted([this.signers.users[0].address], [1], [])).to.be.rejectedWith('args invalid length');
    await expect(admin.burnMinted([], [1], [1])).to.be.rejectedWith('args invalid length');
    await expect(admin.burnMinted([this.signers.users[0].address], [1, 2], [1])).to.be.rejectedWith(
      'args invalid length'
    );
  });

  it('should burn the minted tokens and emit TransferSingle event', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);

    await admin.mint([this.signers.users[0].address, this.signers.users[1].address], [1, 2], [99, 26]);

    // await admin.burnMinted([this.signers.users[0].address, this.signers.users[1].address], [1, 2], [93, 20]);

    await expect(admin.burnMinted([this.signers.users[0].address, this.signers.users[1].address], [1, 2], [93, 20]))
      .to.emit(admin, 'TransferSingle')
      .withArgs(
        this.signers.admin.address,
        this.signers.users[0].address,
        '0x0000000000000000000000000000000000000000',
        1,
        93
      )
      .to.emit(admin, 'TransferSingle')
      .withArgs(
        this.signers.admin.address,
        this.signers.users[1].address,
        '0x0000000000000000000000000000000000000000',
        2,
        20
      );

    expect(await admin.balanceOf(this.signers.users[0].address, 1)).be.equal(6);
    expect(await admin.balanceOf(this.signers.users[1].address, 2)).be.equal(6);
  });
});
