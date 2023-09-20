import { createMarginlyPool, createMarginlyPoolQuoteTokenIsWETH } from './shared/fixtures';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  assertAccruedRateCoeffs,
  calcLeverageLong,
  calcLeverageShort,
  calcLongSortKey,
  calcShortSortKey,
  CallType,
  convertFP96ToNumber,
  FP48,
  FP96,
  PositionType,
  powTaylor,
  uniswapV3Swapdata,
  ZERO_ADDRESS,
} from './shared/utils';
import { BigNumber } from 'ethers';
import { parseUnits, zeroPad } from 'ethers/lib/utils';

describe('MarginlyPool.Base', () => {
  it('should revert when second try of initialization', async () => {
    const { marginlyPool: pool, factoryOwner } = await loadFixture(createMarginlyPool);

    const quoteToken = await pool.quoteToken();
    const baseToken = await pool.baseToken();
    const uniswapPool = await pool.uniswapPool();

    const marginlyParams = {
      interestRate: 54,
      maxLeverage: 15,
      fee: 1,
      swapFee: 1000,
      priceSecondsAgo: 1000,
      positionMinAmount: 100,
      positionSlippage: 300000,
      mcSlippage: 400000,
      quoteLimit: 1_000_000_000,
    };

    await expect(
      pool.connect(factoryOwner).initialize(quoteToken, baseToken, true, uniswapPool, marginlyParams)
    ).to.be.revertedWithCustomError(pool, 'Forbidden');
  });

  it('should revert when somebody trying to send value', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer] = await ethers.getSigners();

    const valueToSend = parseUnits('1', 18); // 1.0 ETH
    await expect(
      signer.sendTransaction({
        to: marginlyPool.address,
        value: valueToSend,
      })
    ).to.be.revertedWithCustomError(marginlyPool, 'NotWETH9');
  });

  it('sweepETH should revert when sender is not admin', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer] = await ethers.getSigners();

    await expect(marginlyPool.connect(signer).sweepETH()).to.be.revertedWithCustomError(marginlyPool, 'AccessDenied');
  });

  it('sweepETH should be called by admin', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, signer, lender] = await ethers.getSigners();

    const params = await marginlyPool.params();
    await marginlyPool.connect(owner).setParameters({
      ...params,
      quoteLimit: 10000n * 10n ** 18n,
    });

    const quoteDeposit = 1000;
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, quoteDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const baseDeposit = parseUnits('0.0000000001', 18);
    const valueDeposit = parseUnits('1.2000000001', 18);
    const rest = valueDeposit.sub(baseDeposit);

    await marginlyPool
      .connect(signer)
      .execute(CallType.DepositBase, baseDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), { value: valueDeposit });

    const balanceBefore = await owner.getBalance();

    const txReceipt = await (await marginlyPool.connect(owner).sweepETH()).wait();
    const txFee = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);

    const balanceAfter = await owner.getBalance();

    expect(balanceBefore.sub(txFee).add(rest)).to.be.equal(balanceAfter);
  });

  it('should set Marginly parameters by factory owner', async () => {
    const { marginlyPool: pool, factoryOwner } = await loadFixture(createMarginlyPool);

    await pool.connect(factoryOwner).setParameters({
      interestRate: 54,
      fee: 1,
      maxLeverage: 15,
      swapFee: 1000,
      priceSecondsAgo: 1000,
      positionMinAmount: 100,
      positionSlippage: 300000,
      mcSlippage: 400000,
      quoteLimit: 1_000_000_000,
    });

    const params = await pool.params();

    expect(params.interestRate).to.equal(54);
    expect(params.maxLeverage).to.equal(15);
    expect(params.swapFee).to.equal(1000);
    expect(params.priceSecondsAgo).to.equal(1000);
    expect(params.positionMinAmount).to.equal(100);
    expect(params.positionSlippage).to.equal(300000);
    expect(params.mcSlippage).to.equal(400000);
    expect(params.quoteLimit).to.equal(1_000_000_000);
    expect(params.fee).to.equal(1);
  });

  it('should raise error when not an owner trying to set parameters', async () => {
    const { marginlyPool: pool } = await loadFixture(createMarginlyPool);
    const [_, otherSigner] = await ethers.getSigners();

    expect((await pool.positions).length).to.be.equal(0);

    await expect(
      pool.connect(otherSigner).setParameters({
        interestRate: 54,
        maxLeverage: 15,
        fee: 1,
        swapFee: 1000,
        priceSecondsAgo: 1000,
        positionMinAmount: 100,
        positionSlippage: 300000,
        mcSlippage: 400000,
        quoteLimit: 1_000_000_000,
      })
    ).to.be.revertedWithCustomError(pool, 'AccessDenied');
  });

  describe('Deposit base', async () => {
    it('zero amount', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, otherSigner] = await ethers.getSigners();

      await expect(
        marginlyPool.connect(otherSigner).execute(CallType.DepositBase, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'ZeroAmount');
    });

    it('exceeds limit', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, otherSigner] = await ethers.getSigners();

      await expect(
        marginlyPool
          .connect(otherSigner)
          .execute(CallType.DepositBase, 8_000_000, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'ExceedsLimit');
    });

    it('first deposit should create position', async () => {
      const { marginlyPool, quoteContract, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const depositAmount = 1000;

      const tx = await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, depositAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      const depositBaseEvent = (await tx.wait()).events?.find((x) => x.event === 'DepositBase')!;
      expect(depositBaseEvent.args?.user).to.be.equal(signer.address);
      expect(depositBaseEvent.args?.amount).to.be.equal(depositAmount);

      const expectedDBC = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * depositAmount;

      // check aggregates
      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC);
      expect(await marginlyPool.discountedBaseDebt()).to.be.equal(0);

      expect(await baseContract.balanceOf(marginlyPool.address)).to.be.equal(depositAmount);
      expect(await quoteContract.balanceOf(marginlyPool.address)).to.be.equal(0);

      // check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedBaseAmount.toNumber()).to.be.equal(expectedDBC);
      expect(position.discountedQuoteAmount.toNumber()).to.be.equal(0);
      expect(position.heapPosition).to.be.equal(0);
    });

    it('different signers deposits', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer1, signer2] = await ethers.getSigners();
      const firstDeposit = 2468;
      const secondDeposit = 2837;

      await marginlyPool
        .connect(signer1)
        .execute(CallType.DepositBase, firstDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(signer2)
        .execute(CallType.DepositBase, secondDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedDBC1 = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * firstDeposit;
      const expectedDBC2 = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * secondDeposit;

      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC1 + expectedDBC2);
      const positionFirst = await marginlyPool.positions(signer1.address);
      expect(positionFirst.discountedBaseAmount).to.be.equal(expectedDBC1);

      const positionSecond = await marginlyPool.positions(signer2.address);
      expect(positionSecond.discountedBaseAmount).to.be.equal(expectedDBC2);
    });

    it('deposit into positive base position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const firstDeposit = 1000;
      const secondDeposit = 500;
      const total = firstDeposit + secondDeposit;

      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, firstDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, secondDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedDBC = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * total;

      // check aggregates
      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC);
      expect(await marginlyPool.discountedBaseDebt()).to.be.equal(0);

      // check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedBaseAmount.toNumber()).to.be.equal(expectedDBC);
      expect(position.discountedQuoteAmount.toNumber()).to.be.equal(0);
      expect(position.heapPosition).to.be.equal(0);
    });

    it('depositBase into short position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositBase, 10000, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const firstDeposit = 1000;
      const shortAmount = 250;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, firstDeposit, shortAmount, false, ZERO_ADDRESS, uniswapV3Swapdata());

      let positionRealBaseAmount = shortAmount;
      const initialPrice = (await marginlyPool.getBasePrice()).inner;
      let position = await marginlyPool.positions(signer.address);
      expect(position.heapPosition).to.be.equal(1);

      const sortKeyBefore = (await marginlyPool.getHeapPosition(position.heapPosition - 1, true))[1].key;
      const expectedShortKeyBefore = calcShortSortKey(
        initialPrice,
        position.discountedQuoteAmount,
        position.discountedBaseAmount
      );
      expect(sortKeyBefore).to.be.equal(expectedShortKeyBefore);

      const baseDepositFirst = 100;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, baseDepositFirst, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      const baseDebtCoeff = await marginlyPool.baseDebtCoeff();

      position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Short);
      positionRealBaseAmount -= baseDepositFirst;
      expect(position.discountedBaseAmount.mul(baseDebtCoeff).div(FP96.one)).to.be.equal(
        BigNumber.from(positionRealBaseAmount)
      );

      const sortKeyAfter = (await marginlyPool.getHeapPosition(position.heapPosition - 1, true))[1].key;
      const expectedSortKeyAfter = calcShortSortKey(
        initialPrice,
        position.discountedQuoteAmount,
        position.discountedBaseAmount
      );
      expect(sortKeyAfter).to.be.equal(expectedSortKeyAfter);
      // leverage should be less after depositBase
      expect(sortKeyAfter).to.be.lessThan(sortKeyBefore);

      const baseDepositSecond = positionRealBaseAmount * 2;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, baseDepositSecond, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      {
        const position = await marginlyPool.positions(signer.address);
        const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();
        expect(position._type).to.be.equal(PositionType.Lend);
        expect(position.heapPosition).to.be.equal(0);
        expect((await marginlyPool.getHeapPosition(0, true))[0]).to.be.false;
        expect(position.discountedBaseAmount.mul(baseCollateralCoeff).div(FP96.one)).to.be.equal(
          positionRealBaseAmount
        );
      }
    });

    it('depositBase into long position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositQuote, 10000, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const firstDeposit = 1000;
      const longAmount = 63;

      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, firstDeposit, longAmount, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const positionBefore = await marginlyPool.positions(signer.address);
      expect(positionBefore._type).to.be.equal(PositionType.Long);

      const depositBaseAmount = 100;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, depositBaseAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const positionAfter = await marginlyPool.positions(signer.address);
      expect(positionAfter._type).to.be.equal(PositionType.Long);
    });

    it('depositBase and open long position', async () => {
      const { marginlyPool, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();

      const lenderDeposit = 10000;
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositQuote, lenderDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const depositAmount = 1000;
      const longAmount = 100;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, depositAmount, longAmount, false, ZERO_ADDRESS, uniswapV3Swapdata());

      // check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Long);
      expect(position.heapPosition).to.be.equal(1);
    });

    it('depositBase and long into short position should fail', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositBase, 10000, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const firstDeposit = 1000;
      const shortAmount = 200;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, firstDeposit, shortAmount, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const baseDepositFirst = 10;
      const longAmount = 10;
      await expect(
        marginlyPool
          .connect(signer)
          .execute(CallType.DepositBase, baseDepositFirst, longAmount, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'WrongPositionType');
    });

    it('depositBase should wrap ETH into WETH', async () => {
      const { marginlyPool, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();

      const depositAmount = 1000;
      await baseContract.connect(signer).approve(marginlyPool.address, 0);
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, depositAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), {
          value: depositAmount,
        });

      // check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedBaseAmount).to.be.equal(depositAmount);
      expect(position.discountedQuoteAmount).to.be.equal(0);
      expect(position.heapPosition).to.be.equal(0);
    });
  });

  describe('Deposit quote', async () => {
    it('zero amount', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, otherSigner] = await ethers.getSigners();

      await expect(
        marginlyPool.connect(otherSigner).execute(CallType.DepositQuote, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'ZeroAmount');
    });

    it('exceeds limit', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, otherSigner] = await ethers.getSigners();

      await expect(
        marginlyPool
          .connect(otherSigner)
          .execute(CallType.DepositQuote, 2_000_000, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'ExceedsLimit');
    });

    it('first deposit should create position', async () => {
      const { marginlyPool, quoteContract, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const depositAmount = 1500;

      const tx = await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, depositAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      const depositQuoteEvent = (await tx.wait()).events?.find((x) => x.event === 'DepositQuote')!;

      expect(depositQuoteEvent.args?.user).to.be.equal(signer.address);
      expect(depositQuoteEvent.args?.amount).to.be.equal(depositAmount);

      const expectedDQC = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * depositAmount;

      // check aggregates
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC);
      expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(0);
      expect(await baseContract.balanceOf(marginlyPool.address)).to.be.equal(0);
      expect(await quoteContract.balanceOf(marginlyPool.address)).to.be.equal(depositAmount);

      // check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedBaseAmount).to.be.equal(0);
      expect(position.discountedQuoteAmount).to.be.equal(expectedDQC);
    });

    it('deposit into positive quote position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const firstDeposit = 1000;
      const secondDeposit = 500;
      const total = firstDeposit + secondDeposit;

      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, firstDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, secondDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedDQC = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * total;

      // check aggregates
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC);
      expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(0);

      // check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedBaseAmount.toNumber()).to.be.equal(0);
      expect(position.discountedQuoteAmount.toNumber()).to.be.equal(expectedDQC);
      expect(position.heapPosition).to.be.equal(0);
    });

    it('deposit into short position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositBase, 10000, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const firstDeposit = 1000;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, firstDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      const shortAmount = 200;
      await marginlyPool
        .connect(signer)
        .execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const positionBefore = await marginlyPool.positions(signer.address);
      expect(positionBefore._type).to.be.equal(PositionType.Short);

      const quoteDeposit = 300;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, quoteDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const positionAfter = await marginlyPool.positions(signer.address);
      expect(positionAfter._type).to.be.equal(PositionType.Short);
    });

    it('deposit into long position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositQuote, 10000, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      const firstDeposit = 1000;

      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, firstDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      const longAmount = 100;
      const price = (await marginlyPool.getBasePrice()).inner;
      let positionRealQuoteAmount = price.mul(longAmount).div(FP96.one);
      await marginlyPool
        .connect(signer)
        .execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const positionBefore = await marginlyPool.positions(signer.address);
      expect(positionBefore._type).to.be.equal(PositionType.Long);
      expect(positionBefore.heapPosition).to.be.equal(1);

      const quoteDepositFirst = 20;
      positionRealQuoteAmount = positionRealQuoteAmount.sub(quoteDepositFirst);
      expect(positionRealQuoteAmount).to.be.greaterThan(0);
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, quoteDepositFirst, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      {
        const positionAfter = await marginlyPool.positions(signer.address);
        const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
        expect(positionAfter._type).to.be.equal(PositionType.Long);
        expect(positionAfter.discountedQuoteAmount.mul(quoteDebtCoeff).div(FP96.one)).to.be.equal(
          positionRealQuoteAmount
        );
      }

      const quoteDepositSecond = positionRealQuoteAmount.mul(2);
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, quoteDepositSecond, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const positionAfter = await marginlyPool.positions(signer.address);
      const quoteCollateralCoeff = await marginlyPool.quoteDebtCoeff();
      expect(positionAfter._type).to.be.equal(PositionType.Lend);
      expect(positionAfter.heapPosition).to.be.equal(0);
      expect((await marginlyPool.getHeapPosition(0, false))[0]).to.be.false;
      expect(positionAfter.discountedQuoteAmount.mul(quoteCollateralCoeff).div(FP96.one)).to.be.equal(
        positionRealQuoteAmount
      );
    });

    it('depositQuote and open short position', async () => {
      const { marginlyPool, quoteContract, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();

      const lenderDeposit = 10000;
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositBase, lenderDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const depositAmount = 1500;
      const shortAmount = 1000;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, depositAmount, shortAmount, false, ZERO_ADDRESS, uniswapV3Swapdata());

      // check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Short);
      expect(position.heapPosition).to.be.equal(1);
    });

    it('depositQuote and short into long position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositQuote, 10000, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      const firstDeposit = 1000;
      const longAmount = 63;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, firstDeposit, longAmount, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const positionBefore = await marginlyPool.positions(signer.address);
      expect(positionBefore._type).to.be.equal(PositionType.Long);

      const quoteDepositSecond = 300;
      const shortAmount = 100;
      await expect(
        marginlyPool
          .connect(signer)
          .execute(CallType.DepositQuote, quoteDepositSecond, shortAmount, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'WrongPositionType');
    });

    it('depositQuote and short into short position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositBase, 10000, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      const firstDeposit = 1000;
      const shortAmount1 = 63;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, firstDeposit, shortAmount1, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const positionBefore = await marginlyPool.positions(signer.address);
      expect(positionBefore._type).to.be.equal(PositionType.Short);

      const quoteDepositSecond = 300;
      const shortAmount2 = 100;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, quoteDepositSecond, shortAmount2, false, ZERO_ADDRESS, uniswapV3Swapdata());
      expect(positionBefore._type).to.be.equal(PositionType.Short);
    });

    it('depositQuote should wrap ETH to WETH', async () => {
      const { marginlyPool, quoteContract } = await loadFixture(createMarginlyPoolQuoteTokenIsWETH);
      const [_, signer] = await ethers.getSigners();

      const depositAmount = 1000;
      await quoteContract.connect(signer).approve(marginlyPool.address, 0);
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, depositAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata(), {
          value: depositAmount,
        });

      // check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedBaseAmount).to.be.equal(0);
      expect(position.discountedQuoteAmount).to.be.equal(depositAmount);
      expect(position.heapPosition).to.be.equal(0);
    });
  });

  describe('Withdraw base', () => {
    it('should raise error when trying to withdraw zero amount', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();

      await expect(
        marginlyPool.connect(signer).execute(CallType.WithdrawBase, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'ZeroAmount');
    });

    it('should raise error when position not initialized', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer1, signer2] = await ethers.getSigners();
      const amountToDeposit = 654;
      await marginlyPool
        .connect(signer1)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const amountToWithdraw = 89;
      await expect(
        marginlyPool
          .connect(signer2)
          .execute(CallType.WithdrawBase, amountToWithdraw, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'UninitializedPosition');
    });

    it('should decrease base position', async () => {
      const { marginlyPool, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const amountToDeposit = 1000;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const amountToWithdraw = 374;
      const tx = await marginlyPool
        .connect(signer)
        .execute(CallType.WithdrawBase, amountToWithdraw, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      const withdrawBaseEvent = (await tx.wait()).events?.find((x) => x.event === 'WithdrawBase')!;
      expect(withdrawBaseEvent.args?.user).to.be.equal(signer.address);
      expect(withdrawBaseEvent.args?.amount).to.be.equal(amountToWithdraw);

      const expectedRBC = amountToDeposit - amountToWithdraw;
      const expectedDBC = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * expectedRBC;
      const expectedDQC = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * amountToDeposit;

      // check aggregates
      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC);
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC);
      expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(0);
      expect(await marginlyPool.discountedBaseDebt()).to.be.equal(0);
      expect(await baseContract.balanceOf(marginlyPool.address)).to.be.equal(amountToDeposit - amountToWithdraw);

      //check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedBaseAmount).to.be.equal(expectedDBC);
      expect(position.discountedQuoteAmount).to.be.equal(expectedDQC);
    });

    it('withdraw with position removing', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const amountToDeposit = 1000;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      await marginlyPool
        .connect(signer)
        .execute(CallType.WithdrawQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(signer)
        .execute(CallType.WithdrawBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      //check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Uninitialized);
      expect(position.discountedBaseAmount).to.be.eq(0);
      expect(position.discountedQuoteAmount).to.be.eq(0);
    });

    it('withdrawBase should unwrap WETH to ETH', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();

      const params = await marginlyPool.params();
      await marginlyPool.setParameters({ ...params, quoteLimit: BigNumber.from(4000n * 10n ** 18n) });

      const amountToDeposit = BigNumber.from(2n * 10n ** 18n); //2 ETH
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const balanceBefore = await signer.getBalance();
      const amountToWithdraw = BigNumber.from(2n * 10n ** 18n); //1 ETH
      const tx = await (
        await marginlyPool
          .connect(signer)
          .execute(CallType.WithdrawBase, amountToWithdraw, 0, true, ZERO_ADDRESS, uniswapV3Swapdata())
      ).wait();
      const balanceAfter = await signer.getBalance();
      const txFee = await tx.gasUsed.mul(tx.effectiveGasPrice);

      expect(balanceBefore.sub(txFee).add(amountToWithdraw)).to.be.equal(balanceAfter);
    });

    it('should raise error when trying to withdraw from short position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, shorter] = await ethers.getSigners();

      const amountToDeposit = 1000;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const shortDeposit = 100;
      const shortAmount = 10;
      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositQuote, shortDeposit, shortAmount, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const amountToWithdraw = 10;
      await expect(
        marginlyPool
          .connect(shorter)
          .execute(CallType.WithdrawBase, amountToWithdraw, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'WrongPositionType');
    });
  });

  describe('Withdraw quote', () => {
    it('should raise error when trying to withdraw zero amount', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();

      await expect(
        marginlyPool.connect(signer).execute(CallType.WithdrawQuote, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'ZeroAmount');
    });

    it('should raise error when position not initialized', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer1, signer2] = await ethers.getSigners();
      const amountToDeposit = 543;
      await marginlyPool
        .connect(signer1)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const amountToWithdraw = 125;
      await expect(
        marginlyPool
          .connect(signer2)
          .execute(CallType.WithdrawQuote, amountToWithdraw, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'UninitializedPosition');
    });

    it('should decrease quote position', async () => {
      const { marginlyPool, quoteContract } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const amountToDeposit = 1000;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const amountToWithdraw = 589;
      const tx = await marginlyPool
        .connect(signer)
        .execute(CallType.WithdrawQuote, amountToWithdraw, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      const withdrawQuoteEvent = (await tx.wait()).events?.find((x) => x.event === 'WithdrawQuote')!;
      expect(withdrawQuoteEvent.args?.user).to.be.equal(signer.address);
      expect(withdrawQuoteEvent.args?.amount).to.be.equal(amountToWithdraw);

      const expectedRQC = amountToDeposit - amountToWithdraw;
      const expectedDQC = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * expectedRQC;
      const expectedDBC = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * amountToDeposit;

      // check aggregates
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC);
      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC);
      expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(0);
      expect(await marginlyPool.discountedBaseDebt()).to.be.equal(0);
      expect(await quoteContract.balanceOf(marginlyPool.address)).to.be.equal(amountToDeposit - amountToWithdraw);

      //check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Lend);
      expect(position.discountedBaseAmount.toNumber()).to.be.equal(expectedDBC);
      expect(position.discountedQuoteAmount.toNumber()).to.be.equal(expectedDQC);
    });

    it('reinit', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, user1, user2] = await ethers.getSigners();
      const timeShift = 300 * 24 * 60 * 60;

      const user1BaseDeposit = 1000;
      const user1LongAmount = 1500;

      const user2QuoteDeposit = 5000;
      const user2ShortAmount = 600;

      await marginlyPool
        .connect(user1)
        .execute(CallType.DepositBase, user1BaseDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(user2)
        .execute(CallType.DepositQuote, user2QuoteDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      await marginlyPool
        .connect(user1)
        .execute(CallType.Long, user1LongAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(user2)
        .execute(CallType.Short, user2ShortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const prevBlockNumber = await marginlyPool.provider.getBlockNumber();

      await time.increase(timeShift);
      await marginlyPool.execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      await assertAccruedRateCoeffs(marginlyPool, prevBlockNumber);
    });

    it('withdraw with position removing', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const amountToDeposit = 1000;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      await marginlyPool
        .connect(signer)
        .execute(CallType.WithdrawBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(signer)
        .execute(CallType.WithdrawQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      //check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Uninitialized);
      expect(position.discountedBaseAmount).to.be.eq(0);
      expect(position.discountedQuoteAmount).to.be.eq(0);
    });

    it('withdrawQuote should unwrap WETH to ETH', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPoolQuoteTokenIsWETH);
      const [_, signer] = await ethers.getSigners();

      const params = await marginlyPool.params();
      await marginlyPool.setParameters({ ...params, quoteLimit: BigNumber.from(1000n * 10n ** 18n) });

      const amountToDeposit = BigNumber.from(2n * 10n ** 18n); //2 ETH
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const balanceBefore = await signer.getBalance();
      const amountToWithdraw = BigNumber.from(2n * 10n ** 18n); //1 ETH
      const tx = await (
        await marginlyPool
          .connect(signer)
          .execute(CallType.WithdrawQuote, amountToWithdraw, 0, true, ZERO_ADDRESS, uniswapV3Swapdata())
      ).wait();
      const balanceAfter = await signer.getBalance();
      const txFee = await tx.gasUsed.mul(tx.effectiveGasPrice);

      expect(balanceBefore.sub(txFee).add(amountToWithdraw)).to.be.equal(balanceAfter);
    });

    it('should raise error when trying to withdraw from long position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, longer] = await ethers.getSigners();

      const amountToDeposit = 1000;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const longDeposit = 100;
      const longAmount = 10;
      await marginlyPool
        .connect(longer)
        .execute(CallType.DepositBase, longDeposit, longAmount, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const amountToWithdraw = 10;
      await expect(
        marginlyPool
          .connect(longer)
          .execute(CallType.WithdrawQuote, amountToWithdraw, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'WrongPositionType');
    });
  });

  describe('Close position', () => {
    it('should raise error when attempt to close Uninitialized or Lend position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      await expect(
        marginlyPool.execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'WrongPositionType');

      const amountToDeposit = 1000;
      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await expect(
        marginlyPool.connect(signer).execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'WrongPositionType');
    });

    it('should close short position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const amountToDeposit = 1000;
      const amountOfShort = 100;

      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositQuote, amountToDeposit, amountOfShort, false, ZERO_ADDRESS, uniswapV3Swapdata());

      {
        const position = await marginlyPool.positions(signer.address);
        expect(position._type).to.be.equal(PositionType.Short);
      }

      await marginlyPool
        .connect(signer)
        .execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      {
        const position = await marginlyPool.positions(signer.address);
        expect(position.discountedBaseAmount).to.be.equal(0);
        expect(position._type).to.be.equal(PositionType.Lend);
        expect(position.heapPosition).to.be.equal(0);

        const DBD = BigNumber.from(await marginlyPool.discountedQuoteDebt());
        expect(DBD).to.be.equal(0);
      }
    });

    it('should close long position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositQuote, 1000, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const amountToDeposit = 1000;
      const amountOfLong = 63;

      await marginlyPool
        .connect(signer)
        .execute(CallType.DepositBase, amountToDeposit, amountOfLong, false, ZERO_ADDRESS, uniswapV3Swapdata());

      await marginlyPool
        .connect(signer)
        .execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      {
        const position = await marginlyPool.positions(signer.address);
        expect(position.discountedQuoteAmount).to.be.equal(0);
        expect(position._type).to.be.equal(PositionType.Lend);
        expect(position.heapPosition).to.be.equal(0);

        const DQD = BigNumber.from(await marginlyPool.discountedQuoteDebt());
        expect(DQD).to.be.equal(0);
      }
    });
  });

  describe('Short', () => {
    it('short, wrong user type', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter, depositor] = await ethers.getSigners();
      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const shortAmount = 1000;
      expect(
        marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'WrongPositionType');

      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositQuote, amountToDeposit, shortAmount, false, ZERO_ADDRESS, uniswapV3Swapdata());

      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      expect(
        marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'WrongPositionType');
    });

    it('short minAmount violation', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter, depositor] = await ethers.getSigners();
      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const shortAmount = 1;
      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await expect(
        marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.rejectedWith('LessThanMinimalAmount()');
    });

    it('exceeds limit', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter, depositor] = await ethers.getSigners();
      const amountToDeposit = 450_000;
      const basePrice = (await marginlyPool.getBasePrice()).inner;
      const shortAmount = BigNumber.from(200_000).mul(FP96.one).div(basePrice);

      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      // 450 + 450 + 200 > 1000
      await expect(
        marginlyPool.connect(shorter).execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'ExceedsLimit');
    });

    it('short should update leverageShort', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter, depositor] = await ethers.getSigners();
      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const shortAmount = 1000;
      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(shorter)
        .execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const basePrice = await marginlyPool.getBasePrice();
      const position = await marginlyPool.positions(shorter.address);
      const shortHeapPositionKey = (await marginlyPool.getHeapPosition(position.heapPosition - 1, true))[1].key;

      const expectedShortKey = calcShortSortKey(
        basePrice.inner,
        position.discountedQuoteAmount,
        position.discountedBaseAmount
      );

      expect(shortHeapPositionKey).to.be.equal(expectedShortKey);

      const leverageShort = (await marginlyPool.systemLeverage()).shortX96;
      const expectedLeverageShort = calcLeverageShort(
        basePrice.inner,
        await marginlyPool.quoteCollateralCoeff(),
        await marginlyPool.baseDebtCoeff(),
        await marginlyPool.discountedQuoteCollateral(),
        await marginlyPool.discountedBaseDebt()
      );

      expect(leverageShort).to.be.equal(expectedLeverageShort);
    });

    it('short, changed from lend to short', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter, depositor] = await ethers.getSigners();
      const one = BigNumber.from(FP96.one);
      const swapFee = 0.5;
      const params = await marginlyPool.params();
      await marginlyPool.setParameters({ ...params, swapFee: 500_000 });
      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedDBC0 = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * amountToDeposit;
      const expectedDQC0 = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * amountToDeposit;
      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC0);
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC0);

      const shorterPositionBefore = await marginlyPool.positions(shorter.address);
      expect(shorterPositionBefore._type).to.be.equal(PositionType.Lend);
      expect(shorterPositionBefore.discountedBaseAmount.toNumber()).to.be.equal(0);
      expect(shorterPositionBefore.discountedQuoteAmount.toNumber()).to.be.equal(expectedDQC0);

      const price = (await marginlyPool.getBasePrice()).inner;
      const shortAmount = 1000;
      await marginlyPool
        .connect(shorter)
        .execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedDBC1 = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * amountToDeposit;
      const expectedRQC1 = BigNumber.from(amountToDeposit).add(
        BigNumber.from((1 - swapFee) * shortAmount)
          .mul(price)
          .div(one)
      );
      const expectedDQC1 = (await marginlyPool.quoteCollateralCoeff()).mul(expectedRQC1).div(one);
      const debtCoeff = BigNumber.from(await marginlyPool.baseDebtCoeff());
      const expectedRBD1 = BigNumber.from(shortAmount);
      const expectedDBD1 = expectedRBD1.mul(one).div(debtCoeff);
      const leverageShortDenom = expectedRQC1.sub(expectedRBD1.mul(price).div(one));

      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC1);
      expect(await marginlyPool.discountedBaseDebt()).to.be.equal(expectedDBD1);
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC1);
      expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(0);

      const expectedLeverageShort = calcLeverageShort(
        price,
        await marginlyPool.quoteCollateralCoeff(),
        await marginlyPool.baseDebtCoeff(),
        await marginlyPool.discountedQuoteCollateral(),
        await marginlyPool.discountedBaseDebt()
      );
      expect((await marginlyPool.systemLeverage()).shortX96).to.be.equal(expectedLeverageShort);

      const shorterPositionAfter = await marginlyPool.positions(shorter.address);
      expect(shorterPositionAfter._type).to.be.equal(PositionType.Short);
      expect(shorterPositionAfter.discountedBaseAmount.eq(expectedDBD1));
      expect(shorterPositionAfter.discountedQuoteAmount.toNumber()).to.be.equal(expectedDQC1);
    });

    it('short, update short position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter, depositor] = await ethers.getSigners();
      const swapFee = 0.5;
      const params = await marginlyPool.params();
      await marginlyPool.setParameters({ ...params, swapFee: 500_000 });
      const one = BigNumber.from(FP96.one);
      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedDBC0 = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * amountToDeposit;
      const expectedDQC0 = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * amountToDeposit;
      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC0);
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC0);

      const shorterPositionBefore = await marginlyPool.positions(shorter.address);
      expect(shorterPositionBefore._type).to.be.equal(PositionType.Lend);
      expect(shorterPositionBefore.discountedBaseAmount.toNumber()).to.be.equal(0);
      expect(shorterPositionBefore.discountedQuoteAmount.toNumber()).to.be.equal(expectedDQC0);

      const price = (await marginlyPool.getBasePrice()).inner;
      const shortAmount = 1000;
      await marginlyPool
        .connect(shorter)
        .execute(CallType.Short, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedDBC1 = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * amountToDeposit;
      const expectedRQC1 =
        amountToDeposit +
        +BigNumber.from((1 - swapFee) * shortAmount)
          .mul(price)
          .div(one);
      const expectedDQC1 = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * expectedRQC1;
      const debtCoeff1 = BigNumber.from(await marginlyPool.baseDebtCoeff());
      const expectedDBD1 = BigNumber.from(shortAmount).mul(one).div(debtCoeff1);

      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC1);
      expect(await marginlyPool.discountedBaseDebt()).to.be.equal(expectedDBD1);
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC1);
      expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(0);

      const expectedLeverageShort1 = calcLeverageShort(
        price,
        await marginlyPool.quoteCollateralCoeff(),
        await marginlyPool.baseDebtCoeff(),
        await marginlyPool.discountedQuoteCollateral(),
        await marginlyPool.discountedBaseDebt()
      );
      expect((await marginlyPool.systemLeverage()).shortX96).to.be.equal(expectedLeverageShort1);

      const shorterPositionAfter = await marginlyPool.positions(shorter.address);
      expect(shorterPositionAfter._type).to.be.equal(PositionType.Short);
      expect(shorterPositionAfter.discountedBaseAmount.toNumber()).to.be.equal(expectedDBD1);
      expect(shorterPositionAfter.discountedQuoteAmount.toNumber()).to.be.equal(expectedDQC1);

      const shortAmount2 = 2000;
      await marginlyPool
        .connect(shorter)
        .execute(CallType.Short, shortAmount2, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const totalShortAmount = shortAmount + shortAmount2;
      const expectedDBC2 = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * amountToDeposit;
      const expectedRQC2 =
        amountToDeposit +
        +BigNumber.from((1 - swapFee) * totalShortAmount)
          .mul(price)
          .div(one);
      const expectedDQC2 = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * expectedRQC2;
      const debtCoeff2 = BigNumber.from(await marginlyPool.baseDebtCoeff());

      const expectedDBD2 = BigNumber.from(totalShortAmount).mul(one).div(debtCoeff2);
      const epsilon = BigNumber.from(1); // floating point with calculation error
      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(Math.floor(expectedDBC2));
      expect((await marginlyPool.discountedBaseDebt()).sub(expectedDBD2).abs()).to.be.lessThanOrEqual(epsilon);
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(Math.floor(expectedDQC2));
      expect(await marginlyPool.discountedQuoteDebt()).to.be.equal(0);

      const expectedLeverageShort2 = calcLeverageShort(
        price,
        await marginlyPool.quoteCollateralCoeff(),
        await marginlyPool.baseDebtCoeff(),
        await marginlyPool.discountedQuoteCollateral(),
        await marginlyPool.discountedBaseDebt()
      );
      expect((await marginlyPool.systemLeverage()).shortX96).to.be.equal(expectedLeverageShort2);

      const shorterPositionAfterUpdate = await marginlyPool.positions(shorter.address);
      expect(shorterPositionAfterUpdate._type).to.be.equal(PositionType.Short);
      expect(BigNumber.from(shorterPositionAfterUpdate.discountedBaseAmount).sub(expectedDBD2)).to.be.lessThanOrEqual(
        epsilon
      );
      expect(shorterPositionAfterUpdate.discountedQuoteAmount.toNumber()).to.be.equal(Math.floor(expectedDQC2));
    });
  });

  describe('Long', () => {
    it('uninitialized', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, longer, depositor] = await ethers.getSigners();
      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const longAmount = 1000;
      expect(
        marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'UninitializedPosition');
    });

    it('long minAmount violation', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, longer, depositor] = await ethers.getSigners();
      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const shortAmount = 1;
      await marginlyPool
        .connect(longer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await expect(
        marginlyPool.connect(longer).execute(CallType.Long, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.rejectedWith('LessThanMinimalAmount()');
    });

    it('exceeds limit', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, longer, depositor] = await ethers.getSigners();
      const amountToDeposit = 400_000;

      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(longer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const basePrice = (await marginlyPool.getBasePrice()).inner;
      const quoteLimit = (await marginlyPool.params()).quoteLimit;
      const longAmount = quoteLimit.mul(FP96.one).div(basePrice);
      await expect(
        marginlyPool.connect(longer).execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata())
      ).to.be.revertedWithCustomError(marginlyPool, 'ExceedsLimit');
    });

    it('long should update leverageLong', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, longer, depositor] = await ethers.getSigners();
      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const shortAmount = 1000;
      await marginlyPool
        .connect(longer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(longer)
        .execute(CallType.Long, shortAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const position = await marginlyPool.positions(longer.address);
      const basePrice = await marginlyPool.getBasePrice();
      const initialPrice = (await marginlyPool.getBasePrice()).inner;

      const longHeapPositionKey = (await marginlyPool.getHeapPosition(position.heapPosition - 1, false))[1].key;

      const expectedSortKey = calcLongSortKey(
        initialPrice,
        position.discountedQuoteAmount,
        position.discountedBaseAmount
      );

      expect(longHeapPositionKey).to.be.equal(expectedSortKey);
      const leverageLong = (await marginlyPool.systemLeverage()).longX96;
      const expectedLeverageLong = calcLeverageLong(
        basePrice.inner,
        await marginlyPool.quoteDebtCoeff(),
        await marginlyPool.baseCollateralCoeff(),
        await marginlyPool.discountedQuoteDebt(),
        await marginlyPool.discountedBaseCollateral()
      );

      expect(leverageLong).to.be.equal(expectedLeverageLong);
    });

    it('changed from lend to long', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, longer, depositor] = await ethers.getSigners();
      const swapFee = 0.1;
      const one = BigNumber.from(FP96.one);
      const params = await marginlyPool.params();
      await marginlyPool.setParameters({ ...params, swapFee: 100_000 });
      const amountToDeposit = 100000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(longer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedDBC = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * amountToDeposit;
      const expectedDQC = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * amountToDeposit;

      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC);
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC);

      const longerPositionBefore = await marginlyPool.positions(longer.address);
      expect(longerPositionBefore._type).to.be.equal(PositionType.Lend);
      expect(longerPositionBefore.discountedBaseAmount.toNumber()).to.be.equal(expectedDBC);
      expect(longerPositionBefore.discountedQuoteAmount.toNumber()).to.be.equal(0);

      const price = (await marginlyPool.getBasePrice()).inner;
      const longAmount = 1000;
      const quoteAmount = BigNumber.from((1.0 + swapFee) * longAmount)
        .mul(price)
        .div(one);
      await marginlyPool
        .connect(longer)
        .execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedRBC1 = BigNumber.from(amountToDeposit + longAmount);
      const expectedDBC1 = (await marginlyPool.baseCollateralCoeff()).mul(expectedRBC1).div(one);
      const expectedDQC1 = (await marginlyPool.quoteCollateralCoeff()).mul(BigNumber.from(amountToDeposit)).div(one);
      const debtCoeff = await marginlyPool.quoteDebtCoeff();
      const expectedDQD1 = quoteAmount.mul(one).div(debtCoeff);
      const leverageLongDenom = expectedRBC1.sub(quoteAmount.mul(price).div(one));

      const epsilon = BigNumber.from(1); // floating point with calculation error
      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC1);
      expect(await marginlyPool.discountedBaseDebt()).to.be.equal(0);
      expect((await marginlyPool.discountedQuoteDebt()).sub(expectedDQD1)).to.be.lessThanOrEqual(epsilon);
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC1);

      const expectedLeverageLong = calcLeverageLong(
        price,
        await marginlyPool.quoteDebtCoeff(),
        await marginlyPool.baseCollateralCoeff(),
        await marginlyPool.discountedQuoteDebt(),
        await marginlyPool.discountedBaseCollateral()
      );
      expect((await marginlyPool.systemLeverage()).longX96).to.be.equal(expectedLeverageLong);

      const longerPositionAfter = await marginlyPool.positions(longer.address);
      expect(longerPositionAfter._type).to.be.equal(PositionType.Long);
      expect(longerPositionAfter.discountedBaseAmount.toNumber()).to.be.equal(expectedDBC1);
      expect(BigNumber.from(longerPositionAfter.discountedQuoteAmount).sub(expectedDQD1).abs()).to.be.lessThanOrEqual(
        epsilon
      );
    });

    it('update long position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, longer, depositor] = await ethers.getSigners();
      const swapFee = 0.1;
      const one = BigNumber.from(FP96.one);
      const params = await marginlyPool.params();
      await marginlyPool.setParameters({ ...params, swapFee: 100_000 });
      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(longer)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedDBC = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * amountToDeposit;
      const expectedDQC = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * amountToDeposit;

      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC);
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC);

      const longerPositionBefore = await marginlyPool.positions(longer.address);
      expect(longerPositionBefore._type).to.be.equal(PositionType.Lend);
      expect(longerPositionBefore.discountedBaseAmount.toNumber()).to.be.equal(amountToDeposit);
      expect(longerPositionBefore.discountedQuoteAmount.toNumber()).to.be.equal(0);

      const price = (await marginlyPool.getBasePrice()).inner;
      const longAmount = 600;
      const quoteAmount = BigNumber.from((1.0 + swapFee) * longAmount)
        .mul(price)
        .div(FP96.one);
      await marginlyPool
        .connect(longer)
        .execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedRBC1 = amountToDeposit + longAmount;
      const expectedDBC1 = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * expectedRBC1;
      const expectedDQC1 = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * amountToDeposit;
      const debtCoeff = BigNumber.from(await marginlyPool.quoteDebtCoeff());
      const expectedDQD1 = quoteAmount.mul(FP96.one).div(debtCoeff);

      const epsilon = BigNumber.from(2); // floating point with calculation error
      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC1);
      expect(await marginlyPool.discountedBaseDebt()).to.be.equal(0);
      expect((await marginlyPool.discountedQuoteDebt()).sub(expectedDQD1).abs()).to.be.lessThanOrEqual(epsilon);
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(expectedDQC1);

      const expectedLeverageLong1 = calcLeverageLong(
        price,
        await marginlyPool.quoteDebtCoeff(),
        await marginlyPool.baseCollateralCoeff(),
        await marginlyPool.discountedQuoteDebt(),
        await marginlyPool.discountedBaseCollateral()
      );
      expect((await marginlyPool.systemLeverage()).longX96).to.be.equal(expectedLeverageLong1);

      const longerPositionAfter = await marginlyPool.positions(longer.address);
      expect(longerPositionAfter._type).to.be.equal(PositionType.Long);
      expect(longerPositionAfter.discountedBaseAmount.toNumber()).to.be.equal(expectedDBC1);
      expect(longerPositionAfter.discountedQuoteAmount.sub(expectedDQD1).abs()).to.be.lessThanOrEqual(epsilon);

      const longAmount2 = 2000;
      const totalLongAmount = longAmount + longAmount2;
      const quoteAmount2 = BigNumber.from((1.0 + swapFee) * longAmount2)
        .mul(price)
        .div(FP96.one);
      const totalQuoteAmount = quoteAmount.add(quoteAmount2);
      await marginlyPool
        .connect(longer)
        .execute(CallType.Long, longAmount2, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const expectedRBC2 = amountToDeposit + longAmount + longAmount2;
      const expectedDBC2 = convertFP96ToNumber(await marginlyPool.baseCollateralCoeff()) * expectedRBC2;
      const expectedDQC2 = convertFP96ToNumber(await marginlyPool.quoteCollateralCoeff()) * amountToDeposit;
      const debtCoeff2 = BigNumber.from(await marginlyPool.quoteDebtCoeff());
      const expectedDQD2 = BigNumber.from(totalQuoteAmount).mul(one).div(debtCoeff2);

      expect(await marginlyPool.discountedBaseCollateral()).to.be.equal(expectedDBC2);
      expect(await marginlyPool.discountedBaseDebt()).to.be.equal(0);
      expect((await marginlyPool.discountedQuoteDebt()).sub(expectedDQD2).abs()).to.be.lessThanOrEqual(epsilon);
      expect(await marginlyPool.discountedQuoteCollateral()).to.be.equal(Math.floor(expectedDQC2));

      const expectedLeverageLong2 = calcLeverageLong(
        price,
        await marginlyPool.quoteDebtCoeff(),
        await marginlyPool.baseCollateralCoeff(),
        await marginlyPool.discountedQuoteDebt(),
        await marginlyPool.discountedBaseCollateral()
      );
      expect((await marginlyPool.systemLeverage()).longX96).to.be.equal(expectedLeverageLong2);

      const longerPositionAfterUpdate = await marginlyPool.positions(longer.address);
      expect(longerPositionAfterUpdate._type).to.be.equal(PositionType.Long);
      expect(longerPositionAfterUpdate.discountedBaseAmount.toNumber()).to.be.equal(expectedDBC2);
      expect(longerPositionAfterUpdate.discountedQuoteAmount.sub(expectedDQD2).abs()).to.be.lessThanOrEqual(epsilon);
    });
  });

  describe('Position sort keys', () => {
    it('should properly calculate sort key for long position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, longer1, depositor] = await ethers.getSigners();

      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(longer1)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const amountToLong = 250;
      await marginlyPool
        .connect(longer1)
        .execute(CallType.Long, amountToLong, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const position1 = await marginlyPool.positions(longer1.address);
      const [success, node] = await marginlyPool.getHeapPosition(position1.heapPosition - 1, false);
      expect(success).to.be.true;

      const longSortKeyX48 = node.key;

      const initialPrice = (await marginlyPool.getBasePrice()).inner;

      const expectedLongSortKeyX48 = position1.discountedQuoteAmount
        .mul(FP48.Q48)
        .div(initialPrice.mul(position1.discountedBaseAmount).div(FP96.one));

      expect(longSortKeyX48).to.be.equal(expectedLongSortKeyX48);
    });

    it('should properly calculate sort key for short position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter1, depositor] = await ethers.getSigners();

      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(shorter1)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const amountToLong = 25;
      await marginlyPool
        .connect(shorter1)
        .execute(CallType.Short, amountToLong, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const position1 = await marginlyPool.positions(shorter1.address);
      const [success, node] = await marginlyPool.getHeapPosition(position1.heapPosition - 1, true);
      expect(success).to.be.true;

      const shortSortKeyX48 = node.key;

      const initialPrice = (await marginlyPool.getBasePrice()).inner;

      const expectedShortSortKeyX48 = initialPrice
        .mul(position1.discountedBaseAmount)
        .div(FP96.one)
        .mul(FP48.Q48)
        .div(position1.discountedQuoteAmount);

      expect(shortSortKeyX48).to.be.equal(expectedShortSortKeyX48);
    });

    it('long position sortKey', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, longer1, longer2, depositor] = await ethers.getSigners();

      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const longAmount1 = 10;
      await marginlyPool
        .connect(longer1)
        .execute(CallType.DepositBase, amountToDeposit, longAmount1, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const longAmount2 = 25;
      await marginlyPool
        .connect(longer2)
        .execute(CallType.DepositBase, amountToDeposit, longAmount2, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const position1 = await marginlyPool.positions(longer1.address);
      const position2 = await marginlyPool.positions(longer2.address);

      expect(position2.heapPosition).to.be.lessThan(position1.heapPosition);
    });

    it('short position sortKey', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter1, shorter2, shorter3, depositor] = await ethers.getSigners();

      const amountToDeposit = 10000;
      await marginlyPool
        .connect(depositor)
        .execute(CallType.DepositBase, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const shortAmount1 = 10;
      await marginlyPool
        .connect(shorter1)
        .execute(CallType.DepositQuote, amountToDeposit, shortAmount1, false, ZERO_ADDRESS, uniswapV3Swapdata());

      const shortAmount2 = 25;
      await marginlyPool
        .connect(shorter2)
        .execute(CallType.DepositQuote, amountToDeposit, shortAmount2, false, ZERO_ADDRESS, uniswapV3Swapdata());
      await marginlyPool
        .connect(shorter3)
        .execute(CallType.DepositQuote, amountToDeposit, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      let position1 = await marginlyPool.positions(shorter1.address);
      let position2 = await marginlyPool.positions(shorter2.address);

      expect(position2.heapPosition).to.be.lessThan(position1.heapPosition);

      const shortAmount3 = 45;
      await marginlyPool
        .connect(shorter3)
        .execute(CallType.Short, shortAmount3, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

      position1 = await marginlyPool.positions(shorter1.address);
      position2 = await marginlyPool.positions(shorter2.address);
      const position3 = await marginlyPool.positions(shorter3.address);

      expect(position1.heapPosition).to.be.equal(2);
      expect(position2.heapPosition).to.be.equal(3);
      expect(position3.heapPosition).to.be.equal(1);
    });
  });

  it('should limit system leverage after long liquidation', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [, longer1, longer2, depositor] = await ethers.getSigners();

    const depositAmount = 40000;
    await marginlyPool
      .connect(depositor)
      .execute(CallType.DepositQuote, depositAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const baseCollateral1 = 100;
    const longAmount1 = 1980; // leverage 20
    await marginlyPool
      .connect(longer1)
      .execute(CallType.DepositBase, baseCollateral1, longAmount1, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const baseCollateral2 = 100;
    const longAmount2 = 1900; // leverage 19.2
    await marginlyPool
      .connect(longer2)
      .execute(CallType.DepositBase, baseCollateral2, longAmount2, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const longer1PositionBefore = await marginlyPool.positions(longer1.address);
    expect(longer1PositionBefore.heapPosition).to.be.eq(1);

    const longer2PositionBefore = await marginlyPool.positions(longer2.address);
    expect(longer2PositionBefore.heapPosition).to.be.eq(2);

    const systemLeverageLongBefore = convertFP96ToNumber((await marginlyPool.systemLeverage()).longX96);
    expect(systemLeverageLongBefore).to.be.lessThan(20);

    // wait 2 days for accrue interest
    const timeShift = 2 * 24 * 60 * 60;
    await time.increase(timeShift);

    await marginlyPool.connect(depositor).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const longer1PositionAfter = await marginlyPool.positions(longer1.address);
    expect(longer1PositionAfter.heapPosition).to.be.eq(0);

    const longer2PositionAfter = await marginlyPool.positions(longer2.address);
    expect(longer2PositionAfter.heapPosition).to.be.eq(1);

    const basePrice = await marginlyPool.getBasePrice();
    const longer2LeverageAfter = convertFP96ToNumber(
      calcLeverageLong(
        basePrice.inner,
        await marginlyPool.quoteDebtCoeff(),
        await marginlyPool.baseCollateralCoeff(),
        longer2PositionAfter.discountedQuoteAmount,
        longer2PositionAfter.discountedBaseAmount
      )
    );
    expect(longer2LeverageAfter).to.be.greaterThan(20);

    const systemLeverageLongAfter = convertFP96ToNumber((await marginlyPool.systemLeverage()).longX96);
    expect(systemLeverageLongAfter).to.be.eq(20);
  });

  it('should limit system leverage after short liquidation', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [, shorter1, shorter2, depositor] = await ethers.getSigners();

    const depositAmount = 40000;
    await marginlyPool
      .connect(depositor)
      .execute(CallType.DepositBase, depositAmount, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const quoteCollateral1 = 100;
    const shortAmount1 = 7600; // leverage 19.99
    await marginlyPool
      .connect(shorter1)
      .execute(CallType.DepositQuote, quoteCollateral1, shortAmount1, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const quoteCollateral2 = 100;
    const shortAmount2 = 7500; // leverage 19.74
    await marginlyPool
      .connect(shorter2)
      .execute(CallType.DepositQuote, quoteCollateral2, shortAmount2, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const shorter1PositionBefore = await marginlyPool.positions(shorter1.address);
    expect(shorter1PositionBefore.heapPosition).to.be.eq(1);

    const shorter2PositionBefore = await marginlyPool.positions(shorter2.address);
    expect(shorter2PositionBefore.heapPosition).to.be.eq(2);

    const systemLeverageShortBefore = convertFP96ToNumber((await marginlyPool.systemLeverage()).shortX96);
    expect(systemLeverageShortBefore).to.be.lessThan(20);

    // wait 2 days for accrue interest
    const timeShift = 2 * 24 * 60 * 60;
    await time.increase(timeShift);

    await marginlyPool.connect(depositor).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS, uniswapV3Swapdata());

    const shorter1PositionAfter = await marginlyPool.positions(shorter1.address);
    expect(shorter1PositionAfter.heapPosition).to.be.eq(0);

    const shorter2PositionAfter = await marginlyPool.positions(shorter2.address);
    expect(shorter2PositionAfter.heapPosition).to.be.eq(1);

    const basePrice = await marginlyPool.getBasePrice();
    const shorter2LeverageAfter = convertFP96ToNumber(
      calcLeverageShort(
        basePrice.inner,
        await marginlyPool.quoteCollateralCoeff(),
        await marginlyPool.baseDebtCoeff(),
        shorter2PositionAfter.discountedQuoteAmount,
        shorter2PositionAfter.discountedBaseAmount
      )
    );
    expect(shorter2LeverageAfter).to.be.greaterThan(20);

    const systemLeverageShortAfter = convertFP96ToNumber((await marginlyPool.systemLeverage()).shortX96);
    expect(systemLeverageShortAfter).to.be.eq(20);
  });
});
