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

    await marginlyPoolWrapper.connect(signer).long(0, depositBaseAmount, longAmount);

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

    await expect(marginlyPoolWrapper.connect(signer).long(0, depositBaseAmount, longAmount)).to.be.revertedWith('MA');

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

  it('gas cost snapshot', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, signer, lender] = await ethers.getSigners();

    const depositBaseAmount = 1000n;
    const depositQuoteAmount = 5000n;
    const longAmount = 2000n;

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);
    await snapshotGasCost(await marginlyPoolWrapper.connect(signer).long(0, depositBaseAmount, longAmount));
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

    await marginlyPoolWrapper.connect(signer).short(0, depositQuoteAmount, shortAmount);

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

    await expect(marginlyPoolWrapper.connect(signer).short(0, depositQuoteAmount, shortAmount)).to.be.revertedWith('MA');

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

  it('gas cost snapshot', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, signer, lender] = await ethers.getSigners();

    const depositBaseAmount = 5000n;
    const depositQuoteAmount = 1000n;
    const shortAmount = 2000n;

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);
    await snapshotGasCost(await marginlyPoolWrapper.connect(signer).short(0, depositQuoteAmount, shortAmount));
  });
});

describe('MarginlyPoolWrapper manager', () => {
  it('add new address', async () => {
    const { marginlyPoolWrapper, factoryOwner } = await loadFixture(createMarginlyPoolWithWrapper);

    await expect(marginlyPoolWrapper.marginlyPoolAddresses(1)).to.be.revertedWithoutReason();
    const newAddress = '0x0000000000000000000000000000000000000001';
    await marginlyPoolWrapper.connect(factoryOwner).addNewPoolAddress(newAddress);

    expect(await marginlyPoolWrapper.marginlyPoolAddresses(1)).to.be.equal(newAddress);
  });

  it('delete address', async () => {
    const { marginlyPoolWrapper, factoryOwner } = await loadFixture(createMarginlyPoolWithWrapper);

    await expect(marginlyPoolWrapper.marginlyPoolAddresses(1)).to.be.revertedWithoutReason();
    const newAddress = '0x0000000000000000000000000000000000000001';
    await marginlyPoolWrapper.connect(factoryOwner).addNewPoolAddress(newAddress);

    expect(await marginlyPoolWrapper.marginlyPoolAddresses(1)).to.be.equal(newAddress);
    await marginlyPoolWrapper.connect(factoryOwner).popPoolAddress(0);
    expect(await marginlyPoolWrapper.marginlyPoolAddresses(0)).to.be.equal(newAddress);
    expect(await marginlyPoolWrapper.marginlyPoolAddresses(1)).to.be.revertedWithoutReason();
  });

  it('add, not manager', async () => {
    const { marginlyPoolWrapper } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, notManager] = await ethers.getSigners();

    const newAddress = '0x0000000000000000000000000000000000000001';
    await expect(marginlyPoolWrapper.connect(notManager).addNewPoolAddress(newAddress)).to.be.revertedWith('AD');
  });

  it('delete, not manager', async () => {
    const { marginlyPoolWrapper } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, notManager] = await ethers.getSigners();

    await expect(marginlyPoolWrapper.connect(notManager).popPoolAddress(0)).to.be.revertedWith('AD');
  });
});