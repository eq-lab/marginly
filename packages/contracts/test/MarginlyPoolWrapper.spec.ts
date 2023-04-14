import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { createMarginlyPoolWithWrapper } from './shared/fixtures';
import { FP96, PositionType } from './shared/utils';
import { expect } from 'chai';
import snapshotGasCost from '@uniswap/snapshot-gas-cost';

describe('MarginlyPoolWrapper long', () => {
  it('success', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, signer, lender] = await ethers.getSigners();

    const depositBaseAmount = 1000n;
    const depositQuoteAmount = 5000n;
    const longAmount = 2000n;

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);

    await marginlyPoolWrapper.connect(signer).long(marginlyPool.address, depositBaseAmount, longAmount);

    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();

    const position = await marginlyPool.positions(signer.address);
    expect(position._type).to.be.equal(PositionType.Long);
    expect(position.discountedBaseAmount.mul(baseCollCoeff)).to.be.equal((depositBaseAmount + longAmount) * FP96.one);

    // Must not exist
    const wrapperContractPosition = await marginlyPool.positions(marginlyPoolWrapper.address);
    expect(wrapperContractPosition._type).to.be.equal(PositionType.Uninitialized);
    expect(wrapperContractPosition.discountedBaseAmount).to.be.equal(0);
    expect(wrapperContractPosition.discountedQuoteAmount).to.be.equal(0);

  });

  it('fail', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, signer, lender] = await ethers.getSigners();

    const depositBaseAmount = 1000n;
    const depositQuoteAmount = 5000n;
    const longAmount = 1n;

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);

    await expect(
      marginlyPoolWrapper.connect(signer).long(marginlyPool.address, depositBaseAmount, longAmount)
    ).to.be.revertedWith('MA');

    const position = await marginlyPool.positions(signer.address);
    expect(position._type).to.be.equal(PositionType.Uninitialized);
    expect(position.discountedBaseAmount).to.be.equal(0);
    expect(position.discountedQuoteAmount).to.be.equal(0);

    // Must not exist
    const wrapperContractPosition = await marginlyPool.positions(marginlyPoolWrapper.address);
    expect(wrapperContractPosition._type).to.be.equal(PositionType.Uninitialized);
    expect(wrapperContractPosition.discountedBaseAmount).to.be.equal(0);
    expect(wrapperContractPosition.discountedQuoteAmount).to.be.equal(0);

  });

  it('pool address isn\'t whitelisted', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, signer, lender] = await ethers.getSigners();

    const depositBaseAmount = 1000n;
    const depositQuoteAmount = 5000n;
    const longAmount = 1n;

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);

    const nullAddress = '0x0000000000000000000000000000000000000000';
    await expect(
      marginlyPoolWrapper.connect(signer).long(nullAddress, depositBaseAmount, longAmount)
    ).to.be.revertedWith('NW');
  });

  it('gas cost snapshot', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, signer, lender] = await ethers.getSigners();

    const depositBaseAmount = 1000n;
    const depositQuoteAmount = 5000n;
    const longAmount = 2000n;

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);
    await snapshotGasCost(
      await marginlyPoolWrapper.connect(signer).long(marginlyPool.address, depositBaseAmount, longAmount)
    );
  });
});

describe('MarginlyPoolWrapper short', () => {
  it('success', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, signer, lender] = await ethers.getSigners();

    const depositBaseAmount = 5000n;
    const depositQuoteAmount = 1000n;
    const shortAmount = 2000n;

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);

    await marginlyPoolWrapper.connect(signer).short(marginlyPool.address, depositQuoteAmount, shortAmount);

    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();
    const price = (await marginlyPool.getBasePrice()).inner;

    const position = await marginlyPool.positions(signer.address);
    expect(position._type).to.be.equal(PositionType.Short);
    const expected = price.mul(shortAmount).add(depositQuoteAmount * FP96.one).div(FP96.one);
    expect(position.discountedQuoteAmount.mul(quoteCollCoeff).div(FP96.one)).to.be.equal(expected);

    // Must not exist
    const wrapperContractPosition = await marginlyPool.positions(marginlyPoolWrapper.address);
    expect(wrapperContractPosition._type).to.be.equal(PositionType.Uninitialized);
    expect(wrapperContractPosition.discountedBaseAmount).to.be.equal(0);
    expect(wrapperContractPosition.discountedQuoteAmount).to.be.equal(0);
  });

  it('fail', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, signer, lender] = await ethers.getSigners();

    const depositBaseAmount = 1000n;
    const depositQuoteAmount = 1000n;
    const shortAmount = 1n;

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);

    await expect(
      marginlyPoolWrapper.connect(signer).short(marginlyPool.address, depositQuoteAmount, shortAmount)
    ).to.be.revertedWith('MA');

    const position = await marginlyPool.positions(signer.address);
    expect(position._type).to.be.equal(PositionType.Uninitialized);
    expect(position.discountedBaseAmount).to.be.equal(0);
    expect(position.discountedQuoteAmount).to.be.equal(0);

    // Must not exist
    const wrapperContractPosition = await marginlyPool.positions(marginlyPoolWrapper.address);
    expect(wrapperContractPosition._type).to.be.equal(PositionType.Uninitialized);
    expect(wrapperContractPosition.discountedBaseAmount).to.be.equal(0);
    expect(wrapperContractPosition.discountedQuoteAmount).to.be.equal(0);

  });

  it('pool address isn\'t whitelisted', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, signer, lender] = await ethers.getSigners();

    const depositBaseAmount = 1000n;
    const depositQuoteAmount = 1000n;
    const shortAmount = 1n;

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);

    const nullAddress = '0x0000000000000000000000000000000000000000';
    await expect(
      marginlyPoolWrapper.connect(signer).short(nullAddress, depositQuoteAmount, shortAmount)
    ).to.be.revertedWith('NW');
  });

  it('gas cost snapshot', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, signer, lender] = await ethers.getSigners();

    const depositBaseAmount = 5000n;
    const depositQuoteAmount = 1000n;
    const shortAmount = 2000n;

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);
    await snapshotGasCost(
      await marginlyPoolWrapper.connect(signer).short(marginlyPool.address, depositQuoteAmount, shortAmount)
    );
  });
});

describe('MarginlyPoolWrapper owner', () => {
  it('add new address', async () => {
    const { marginlyPoolWrapper, factoryOwner } = await loadFixture(createMarginlyPoolWithWrapper);

    const newAddress = '0x0000000000000000000000000000000000000001';
    expect(await marginlyPoolWrapper.whitelistedMarginlyPools(newAddress)).to.be.equal(false);
    await marginlyPoolWrapper.connect(factoryOwner).addPoolAddress(newAddress);

    expect(await marginlyPoolWrapper.whitelistedMarginlyPools(newAddress)).to.be.equal(true);
  });

  it('delete address', async () => {
    const { marginlyPool, marginlyPoolWrapper, factoryOwner } = await loadFixture(createMarginlyPoolWithWrapper);

    expect(await marginlyPoolWrapper.whitelistedMarginlyPools(marginlyPool.address)).to.be.equal(true);
    await marginlyPoolWrapper.connect(factoryOwner).deletePoolAddress(marginlyPool.address);
    expect(await marginlyPoolWrapper.whitelistedMarginlyPools(marginlyPool.address)).to.be.equal(false);
  });

  it('add, not owner', async () => {
    const { marginlyPoolWrapper } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, notOwner] = await ethers.getSigners();

    const newAddress = '0x0000000000000000000000000000000000000001';
    await expect(marginlyPoolWrapper.connect(notOwner).addPoolAddress(newAddress)).to.be.revertedWith('AD');
  });

  it('delete, not owner', async () => {
    const { marginlyPool, marginlyPoolWrapper } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, notOwner] = await ethers.getSigners();

    await expect(
      marginlyPoolWrapper.connect(notOwner).deletePoolAddress(marginlyPool.address)
    ).to.be.revertedWith('AD');
  });
});