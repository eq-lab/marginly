import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import { Signers, deployContestWinnerNft } from './shared';
import { ContestWinnerNFT__factory } from '../typechain-types';

describe('createOrUpdate()', function () {
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

    await expect(user.createOrUpdate([], [])).to.be.rejectedWith('Ownable: caller is not the owner');
    await expect(admin.createOrUpdate([], [])).not.to.be.rejected;
  });

  it('should throw error when arguments mismatch length', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);

    await expect(admin.createOrUpdate([], [''])).to.be.rejectedWith('args invalid length');
    await expect(admin.createOrUpdate([1], [])).to.be.rejectedWith('args invalid length');
    await expect(admin.createOrUpdate([1], ['', ''])).to.be.rejectedWith('args invalid length');
    await expect(admin.createOrUpdate([1, 2], [''])).to.be.rejectedWith('args invalid length');
  });

  it('should throw error when uri is empty', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);

    await expect(admin.createOrUpdate([1], [''])).to.be.rejectedWith('invalid uri');
  });

  it('should mint tokens, set uris and emit URI event', async function () {
    const admin = ContestWinnerNFT__factory.connect(await this.contestWinnerNft.getAddress(), this.signers.admin);

    await expect(admin.createOrUpdate([1, 2, 3], ['1', '2', '3']))
      .to.emit(admin, 'URI')
      .withArgs('1', 1)
      .to.emit(admin, 'URI')
      .withArgs('2', 2)
      .to.emit(admin, 'URI')
      .withArgs('3', 3);

    expect(await admin.uri(1)).be.equal('1');
    expect(await admin.uri(2)).be.equal('2');
    expect(await admin.uri(3)).be.equal('3');
  });
});
