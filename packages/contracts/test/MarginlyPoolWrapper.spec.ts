import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import {
  createMarginlyPoolWithWrapper,
  createMarginlyPoolWrapperBaseIsWETH,
  createMarginlyPoolWrapperQuoteIsWETH,
} from './shared/fixtures';
import { FP96, PositionType } from './shared/utils';
import { expect } from 'chai';
import snapshotGasCost from '@uniswap/snapshot-gas-cost';
import { BigNumber } from 'ethers';
import { parseEther, parseUnits } from 'ethers/lib/utils';

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

  it("pool address isn't whitelisted", async () => {
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

  it('long with wrap ETH to WETH', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWrapperBaseIsWETH);
    const [_, signer, lender] = await ethers.getSigners();

    //increase base/quote limits
    const params = await marginlyPool.params();
    const baseLimit = parseUnits('100000000.0', 18);
    const quoteLimit = parseUnits('100000000.0', 18);
    await marginlyPool.setParameters({ ...params, baseLimit, quoteLimit });

    const depositBaseAmount = ethers.utils.parseEther('1.0');
    const depositQuoteAmount = ethers.utils.parseUnits('20.0', 18);
    const longAmount = ethers.utils.parseEther('1.0');

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);

    await marginlyPoolWrapper.connect(signer).long(marginlyPool.address, depositBaseAmount, longAmount, {
      value: depositBaseAmount,
    });

    const baseCollCoeff = await marginlyPool.baseCollateralCoeff();

    const position = await marginlyPool.positions(signer.address);
    expect(position._type).to.be.equal(PositionType.Long);
    expect(position.discountedBaseAmount.mul(baseCollCoeff)).to.be.equal(
      depositBaseAmount.add(longAmount).mul(FP96.one)
    );

    // Must not exist
    const wrapperContractPosition = await marginlyPool.positions(marginlyPoolWrapper.address);
    expect(wrapperContractPosition._type).to.be.equal(PositionType.Uninitialized);
    expect(wrapperContractPosition.discountedBaseAmount).to.be.equal(0);
    expect(wrapperContractPosition.discountedQuoteAmount).to.be.equal(0);
    expect(await ethers.provider.getBalance(marginlyPoolWrapper.address)).to.be.equal(0);
  });
});

describe('MarginlyPoolWrapper short', () => {
  it('success short', async () => {
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

    const discountedQuoteAmount = BigNumber.from(depositQuoteAmount).mul(FP96.one).div(quoteCollCoeff);
    const expected = price.mul(shortAmount).div(FP96.one).mul(FP96.one).div(quoteCollCoeff).add(discountedQuoteAmount);

    expect(position.discountedQuoteAmount).to.be.equal(expected);

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

  it("pool address isn't whitelisted", async () => {
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

  it('short with wrap ETH to WETH', async () => {
    const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWrapperQuoteIsWETH);
    const [_, signer, lender] = await ethers.getSigners();

    //increase base/quote limits
    const params = await marginlyPool.params();
    const baseLimit = parseUnits('100000000.0', 18);
    const quoteLimit = parseUnits('100000000.0', 18);
    await marginlyPool.setParameters({ ...params, baseLimit, quoteLimit });

    const depositBaseAmount = parseUnits('10.0', 18);
    const depositQuoteAmount = parseEther('3.0');
    const shortAmount = parseEther('2.0');

    await marginlyPool.connect(lender).depositBase(depositBaseAmount);
    await marginlyPool.connect(lender).depositQuote(depositQuoteAmount);

    await marginlyPoolWrapper
      .connect(signer)
      .short(marginlyPool.address, depositQuoteAmount, shortAmount, { value: depositQuoteAmount });

    const swapFee = (await marginlyPool.params()).swapFee;
    const quoteCollCoeff = await marginlyPool.quoteCollateralCoeff();

    /**
     * Use hardcoded onchain price for expected value
     * Explanation:
     * oracle price =  19808301812688672535317768450 / 2^96 = 0,250015918
     * default mock price = 19807040628566084398385987584 / 2^96 = 0.25
     */
    //
    const price = BigNumber.from('19807040628566084398385987584');
    //const price = (await marginlyPool.getBasePrice()).inner;

    const position = await marginlyPool.positions(signer.address);
    expect(position._type).to.be.equal(PositionType.Short);

    const discountedQuoteAmount = BigNumber.from(depositQuoteAmount).mul(FP96.one).div(quoteCollCoeff);

    const exchanged = price.mul(BigNumber.from(shortAmount)).div(FP96.one);
    const fee = exchanged.mul(swapFee).div(1e6);
    const expected = exchanged.sub(fee).mul(FP96.one).div(quoteCollCoeff).add(discountedQuoteAmount);

    expect(position.discountedQuoteAmount).to.be.equal(expected);

    // Must not exist
    const wrapperContractPosition = await marginlyPool.positions(marginlyPoolWrapper.address);
    expect(wrapperContractPosition._type).to.be.equal(PositionType.Uninitialized);
    expect(wrapperContractPosition.discountedBaseAmount).to.be.equal(0);
    expect(wrapperContractPosition.discountedQuoteAmount).to.be.equal(0);
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

    await expect(marginlyPoolWrapper.connect(notOwner).deletePoolAddress(marginlyPool.address)).to.be.revertedWith(
      'AD'
    );
  });

  describe('MarginlyPoolWrapper deposit', () => {
    it('depositBase with wrap ETH to WETH', async () => {
      const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWrapperBaseIsWETH);
      const [_, signer] = await ethers.getSigners();

      //increase base/quote limits
      const params = await marginlyPool.params();
      const baseLimit = parseUnits('100000000.0', 18);
      const quoteLimit = parseUnits('100000000.0', 18);
      await marginlyPool.setParameters({ ...params, baseLimit, quoteLimit });

      const depositBaseAmount = ethers.utils.parseEther('1.0');

      await snapshotGasCost(
        marginlyPoolWrapper.connect(signer).depositBase(marginlyPool.address, depositBaseAmount, {
          value: depositBaseAmount,
        })
      );

      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedBaseAmount).to.be.equal(depositBaseAmount);

      // Must not exist
      const wrapperContractPosition = await marginlyPool.positions(marginlyPoolWrapper.address);
      expect(wrapperContractPosition._type).to.be.equal(PositionType.Uninitialized);
      expect(wrapperContractPosition.discountedBaseAmount).to.be.equal(0);
      expect(wrapperContractPosition.discountedQuoteAmount).to.be.equal(0);
      expect(await ethers.provider.getBalance(marginlyPoolWrapper.address)).to.be.equal(0);
    });

    it('depositBase without wrap', async () => {
      const { marginlyPoolWrapper, marginlyPool, baseContract } = await loadFixture(createMarginlyPoolWithWrapper);
      const [_, signer] = await ethers.getSigners();

      //increase base/quote limits
      const params = await marginlyPool.params();
      const baseLimit = parseUnits('100000000.0', 18);
      const quoteLimit = parseUnits('100000000.0', 18);
      await marginlyPool.setParameters({ ...params, baseLimit, quoteLimit });

      const depositBaseAmount = 1000n;

      await snapshotGasCost(marginlyPoolWrapper.connect(signer).depositBase(marginlyPool.address, depositBaseAmount));

      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedBaseAmount).to.be.equal(depositBaseAmount);

      // Must not exist
      const wrapperContractPosition = await marginlyPool.positions(marginlyPoolWrapper.address);
      expect(wrapperContractPosition._type).to.be.equal(PositionType.Uninitialized);
      expect(wrapperContractPosition.discountedBaseAmount).to.be.equal(0);
      expect(wrapperContractPosition.discountedQuoteAmount).to.be.equal(0);
      expect(await ethers.provider.getBalance(marginlyPoolWrapper.address)).to.be.equal(0);
    });

    it('depositQuote with wrap EHT to WETH', async () => {
      const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWrapperQuoteIsWETH);
      const [_, signer] = await ethers.getSigners();

      //increase base/quote limits
      const params = await marginlyPool.params();
      const baseLimit = parseUnits('100000000.0', 18);
      const quoteLimit = parseUnits('100000000.0', 18);
      await marginlyPool.setParameters({ ...params, baseLimit, quoteLimit });

      const depositQuoteAmount = ethers.utils.parseEther('1.0');

      await snapshotGasCost(
        marginlyPoolWrapper.connect(signer).depositQuote(marginlyPool.address, depositQuoteAmount, {
          value: depositQuoteAmount,
        })
      );

      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedQuoteAmount).to.be.equal(depositQuoteAmount);

      // Must not exist
      const wrapperContractPosition = await marginlyPool.positions(marginlyPoolWrapper.address);
      expect(wrapperContractPosition._type).to.be.equal(PositionType.Uninitialized);
      expect(wrapperContractPosition.discountedBaseAmount).to.be.equal(0);
      expect(wrapperContractPosition.discountedQuoteAmount).to.be.equal(0);
      expect(await ethers.provider.getBalance(marginlyPoolWrapper.address)).to.be.equal(0);
    });

    it('depositQuote without wrap', async () => {
      const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWithWrapper);
      const [_, signer] = await ethers.getSigners();

      //increase base/quote limits
      const params = await marginlyPool.params();
      const baseLimit = parseUnits('100000000.0', 18);
      const quoteLimit = parseUnits('100000000.0', 18);
      await marginlyPool.setParameters({ ...params, baseLimit, quoteLimit });

      const depositQuoteAmount = 1000n;

      await snapshotGasCost(marginlyPoolWrapper.connect(signer).depositQuote(marginlyPool.address, depositQuoteAmount));

      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedQuoteAmount).to.be.equal(depositQuoteAmount);

      // Must not exist
      const wrapperContractPosition = await marginlyPool.positions(marginlyPoolWrapper.address);
      expect(wrapperContractPosition._type).to.be.equal(PositionType.Uninitialized);
      expect(wrapperContractPosition.discountedBaseAmount).to.be.equal(0);
      expect(wrapperContractPosition.discountedQuoteAmount).to.be.equal(0);
      expect(await ethers.provider.getBalance(marginlyPoolWrapper.address)).to.be.equal(0);
    });

    it('should fail when sending ETH to wrapper without calldata', async () => {
      const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWrapperBaseIsWETH);
      const [_, signer] = await ethers.getSigners();

      const tx = {
        to: marginlyPoolWrapper.address,
        value: ethers.utils.parseEther('2'),
      };

      await expect(signer.sendTransaction(tx)).to.be.revertedWithoutReason();
    });

    it('refund ETH', async () => {
      const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWrapperBaseIsWETH);
      const [owner, signer] = await ethers.getSigners();

      //increase base/quote limits
      const params = await marginlyPool.params();
      const baseLimit = parseUnits('100000000.0', 18);
      const quoteLimit = parseUnits('100000000.0', 18);
      await marginlyPool.setParameters({ ...params, baseLimit, quoteLimit });

      const depositBaseAmount = ethers.utils.parseEther('1.0');
      const delta = ethers.utils.parseEther('0.5');
      const moreThanDeposit = depositBaseAmount.add(delta);

      await marginlyPoolWrapper.connect(signer).depositBase(marginlyPool.address, depositBaseAmount, {
        value: moreThanDeposit,
      });

      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedBaseAmount).to.be.equal(depositBaseAmount);

      expect(await ethers.provider.getBalance(marginlyPoolWrapper.address)).to.be.equal(delta);

      await expect(marginlyPoolWrapper.connect(signer).refundETH()).to.be.rejectedWith('AD');

      await marginlyPoolWrapper.connect(owner).refundETH();
      expect(await ethers.provider.getBalance(marginlyPoolWrapper.address)).to.be.equal(0);
    });

    it('depositBase should fail when poolAddress is not whitelisted', async () => {
      const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWrapperBaseIsWETH);
      const [owner, signer] = await ethers.getSigners();
      expect(await marginlyPoolWrapper.whitelistedMarginlyPools(marginlyPool.address)).to.be.equal(true);
      await marginlyPoolWrapper.connect(owner).deletePoolAddress(marginlyPool.address);

      const depositBaseAmount = ethers.utils.parseEther('1.0');
      await expect(
        marginlyPoolWrapper.connect(signer).depositBase(marginlyPool.address, depositBaseAmount)
      ).to.be.revertedWith('NW');
    });

    it('depositQuote should fail when poolAddress is not whitelisted', async () => {
      const { marginlyPoolWrapper, marginlyPool } = await loadFixture(createMarginlyPoolWrapperQuoteIsWETH);
      const [owner, signer] = await ethers.getSigners();
      expect(await marginlyPoolWrapper.whitelistedMarginlyPools(marginlyPool.address)).to.be.equal(true);
      await marginlyPoolWrapper.connect(owner).deletePoolAddress(marginlyPool.address);

      const depositQuoteAmount = ethers.utils.parseEther('1.0');
      await expect(
        marginlyPoolWrapper.connect(signer).depositQuote(marginlyPool.address, depositQuoteAmount)
      ).to.be.revertedWith('NW');
    });
  });
});
