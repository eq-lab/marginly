import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deployContestWinnerNft } from './shared';
import { ContestWinnerNFT__factory } from '../typechain-types';

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
    const { contract } = await this.loadFixture(deployContestWinnerNft);
    this.contestWinnerNft = contract;
  });

  it('should require owner', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);
    const owner = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.users[0]);
    const user = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.users[1]);

    admin.mint([this.signers.users[0].address], [1], [100]);

    await expect(admin.burn(this.signers.users[0].address, 1, 1)).to.be.rejectedWith('ERC1155: caller is not token owner or approved');
    await expect(user.burn(this.signers.users[0].address, 1, 1)).to.be.rejectedWith('ERC1155: caller is not token owner or approved');
    await expect(owner.burn(this.signers.users[0].address, 1, 1)).not.to.be.rejected;
  });

  it('should throw error when amount exceeds balance', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);
    const owner = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.users[0]);

    admin.mint([this.signers.users[0].address], [1], [100]);
    admin.mint([this.signers.users[1].address], [1], [100]);

    await expect(owner.burn(this.signers.users[0].address, 1, 99)).not.to.be.rejected;
    await expect(owner.burn(this.signers.users[0].address, 1, 2)).to.be.rejectedWith('ERC1155: burn amount exceeds balance');
    await expect(owner.burn(this.signers.users[0].address, 1, 200)).to.be.rejectedWith('ERC1155: burn amount exceeds totalSupply');
  });

  it('should burn the specified amount of token and emit TransferSingle event', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);
    const owner = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.users[0]);

    admin.mint([this.signers.users[0].address], [1], [100]);

    await expect(owner.burn(this.signers.users[0].address, 1, 99))
      .to.emit(admin, 'TransferSingle')
      .withArgs(
        this.signers.users[0].address,
        this.signers.users[0].address,
        '0x0000000000000000000000000000000000000000',
        1,
        99
      );

    expect(await owner.balanceOf(this.signers.users[0].address, 1)).be.equal(1);
  });
});
