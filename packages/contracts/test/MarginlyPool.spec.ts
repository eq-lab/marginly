import {
  createMarginlyPool,
  createMarginlyPoolQuoteTokenIsWETH,
  createTimeMoveMarginlyPool,
  increatePoolTimestamp,
} from './shared/fixtures';
import { loadFixture } from './shared/mocks';
import { expect } from 'chai';
import { ethers } from './shared/mocks';
import {
  calcLeverageLong,
  calcLeverageShort,
  calcLongSortKey,
  calcShortSortKey,
  convertFP96ToNumber,
  FP48,
  FP96,
  PositionType,
  powTaylor,
} from './shared/utils';
import { BigNumber } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import { getMarginlyPoolParams } from './shared/mocks';
import * as ethers1 from 'ethers';
import { Provider } from 'zksync-web3';

describe.skip('MarginlyPool.Base', () => {
  // it('should revert when second try of initialization', async () => {
  //   const { marginlyPool: pool, factoryOwner } = await loadFixture(createMarginlyPool);
  //
  //   const quoteToken = await pool.quoteToken();
  //   const baseToken = await pool.baseToken();
  //   const uniswapFee = await pool.uniswapFee();
  //   const uniswapPool = await pool.uniswapPool();
  //
  //   const marginlyParams = {
  //     interestRate: 54,
  //     maxLeverage: 15,
  //     swapFee: 1000,
  //     priceSecondsAgo: 1000,
  //     positionMinAmount: 100,
  //     positionSlippage: 300000,
  //     mcSlippage: 400000,
  //     baseLimit: 1_000_000_000,
  //     quoteLimit: 1_000_000_000,
  //   };
  //
  //   await expect(
  //     pool.connect(factoryOwner).initialize(quoteToken, baseToken, uniswapFee, true, uniswapPool, marginlyParams)
  //   ).to.be.revertedWith('FB');
  // });

  it('should revert when somebody trying to send value', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer] = await ethers.getSigners();

    const valueToSend = parseUnits('1', 18); // 1.0 ETH
    expect(
      signer.sendTransaction({
        to: marginlyPool.address,
        value: valueToSend,
      })
    ).to.be.revertedWith('NW9');
  });

  it('sweepETH should revert when sender is not admin', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [_, signer] = await ethers.getSigners();

    expect(marginlyPool.connect(signer).sweepETH()).to.be.revertedWith('AD');
  });

  it('sweepETH should be called by admin', async () => {
    const { marginlyPool } = await loadFixture(createMarginlyPool);
    const [owner, signer, lender] = await ethers.getSigners();

    const params = await getMarginlyPoolParams(marginlyPool);
    await (await marginlyPool.connect(owner).setParameters({
      ...params,
      baseLimit: 10000n * 10n ** 18n,
      quoteLimit: 10000n * 10n ** 18n,
    })).wait();

    const quoteDeposit = 1000;
    await (await marginlyPool.connect(lender).depositQuote(quoteDeposit, 0)).wait();

    const baseDeposit = parseUnits('0.0000000001', 18);
    const valueDeposit = parseUnits('1.2000000001', 18);
    const rest = valueDeposit.sub(baseDeposit);

    await (await marginlyPool.connect(signer).depositBase(baseDeposit, 0, { value: valueDeposit })).wait();

    const balanceBefore = await owner.getBalance();

    const txReceipt = await (await marginlyPool.connect(owner).sweepETH()).wait();
    const txFee = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);

    const balanceAfter = await owner.getBalance();

    expect(balanceBefore.sub(txFee).add(rest)).to.be.equal(balanceAfter);
  });

  it('should set Marginly parameters by factory owner', async () => {
    const { marginlyPool: pool, factoryOwner } = await loadFixture(createMarginlyPool);

    await (await pool.connect(factoryOwner).setParameters({
      interestRate: 54,
      maxLeverage: 15,
      swapFee: 1000,
      priceSecondsAgo: 1000,
      positionMinAmount: 100,
      positionSlippage: 300000,
      mcSlippage: 400000,
      baseLimit: 1_000_000_000,
      quoteLimit: 1_000_000_000,
    })).wait();

    const params = await getMarginlyPoolParams(pool);

    expect(params.interestRate).to.equal(54);
    expect(params.maxLeverage).to.equal(15);
    expect(params.swapFee).to.equal(1000);
    expect(params.priceSecondsAgo).to.equal(1000);
    expect(params.positionMinAmount).to.equal(100);
    expect(params.positionSlippage).to.equal(300000);
    expect(params.mcSlippage).to.equal(400000);
    expect(params.baseLimit).to.equal(1_000_000_000);
    expect(params.quoteLimit).to.equal(1_000_000_000);
  });

  it('should raise error when not an owner trying to set parameters', async () => {
    const { marginlyPool: pool } = await loadFixture(createMarginlyPool);
    const [_, otherSigner] = await ethers.getSigners();

    expect((await pool.positions).length).to.be.equal(0);

    expect(
      pool.connect(otherSigner).setParameters({
        interestRate: 54,
        maxLeverage: 15,
        swapFee: 1000,
        priceSecondsAgo: 1000,
        positionMinAmount: 100,
        positionSlippage: 300000,
        mcSlippage: 400000,
        baseLimit: 1_000_000_000,
        quoteLimit: 1_000_000_000,
      })
    ).to.be.revertedWith('AD');
  });

  describe('Deposit base', async () => {
    it('zero amount', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, otherSigner] = await ethers.getSigners();

      expect(marginlyPool.connect(otherSigner).depositBase(0, 0)).to.be.revertedWith('ZA');
    });

    it('exceeds limit', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, otherSigner] = await ethers.getSigners();

      expect(marginlyPool.connect(otherSigner).depositBase(2_000_000, 0)).to.be.revertedWith('EL');
    });

    it('first deposit should create position', async () => {
      const { marginlyPool, quoteContract, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const depositAmount = 1000;

      const tx = await marginlyPool.connect(signer).depositBase(depositAmount, 0);
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

      await (await marginlyPool.connect(signer1).depositBase(firstDeposit, 0)).wait();
      await (await marginlyPool.connect(signer2).depositBase(secondDeposit, 0)).wait();

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

      await (await marginlyPool.connect(signer).depositBase(firstDeposit, 0)).wait();
      await (await marginlyPool.connect(signer).depositBase(secondDeposit, 0)).wait();

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

    it('deposit into short position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await (await marginlyPool.connect(lender).depositBase(10000, 0)).wait();

      const firstDeposit = 1000;
      const shortAmount = 200;
      await (await marginlyPool.connect(signer).depositQuote(firstDeposit, shortAmount)).wait();

      const initialPrice = await marginlyPool.initialPrice();
      let position = await marginlyPool.positions(signer.address);
      expect(position.heapPosition).to.be.equal(1);

      const sortKeyBefore = (await marginlyPool.getShortHeapPosition(position.heapPosition - 1))[1].key;
      const expectedShortKeyBefore = calcShortSortKey(
        initialPrice,
        position.discountedQuoteAmount,
        position.discountedBaseAmount
      );
      expect(sortKeyBefore).to.be.equal(expectedShortKeyBefore);

      const baseDepositFirst = 100;
      await (await marginlyPool.connect(signer).depositBase(baseDepositFirst, 0)).wait();

      position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Short);

      const sortKeyAfter = (await marginlyPool.getShortHeapPosition(position.heapPosition - 1))[1].key;
      const expectedSortKeyAfter = calcShortSortKey(
        initialPrice,
        position.discountedQuoteAmount,
        position.discountedBaseAmount
      );
      expect(sortKeyAfter).to.be.equal(expectedSortKeyAfter);
      // leverage should be less after depositBase
      expect(sortKeyAfter).to.be.lessThan(sortKeyBefore);

      const baseDepositSecond = 200;
      await (await marginlyPool.connect(signer).depositBase(baseDepositSecond, 0)).wait();

      {
        const position = await marginlyPool.positions(signer.address);
        expect(position._type).to.be.equal(PositionType.Lend);
        expect(position.heapPosition).to.be.equal(0);
        expect((await marginlyPool.getShortHeapPosition(0))[0]).to.be.false;
      }
    });

    it('deposit into long position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await (await marginlyPool.connect(lender).depositQuote(10000, 0)).wait();

      const firstDeposit = 1000;
      const longAmount = 63;

      await (await marginlyPool.connect(signer).depositBase(firstDeposit, longAmount)).wait();

      const positionBefore = await marginlyPool.positions(signer.address);
      expect(positionBefore._type).to.be.equal(PositionType.Long);

      const depositBaseAmount = 100;
      await (await marginlyPool.connect(signer).depositBase(depositBaseAmount, 0)).wait();

      const positionAfter = await marginlyPool.positions(signer.address);
      expect(positionAfter._type).to.be.equal(PositionType.Long);
    });

    it('depositBase and open long position', async () => {
      const { marginlyPool, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();

      const lenderDeposit = 10000;
      await (await marginlyPool.connect(lender).depositQuote(lenderDeposit, 0)).wait();

      const depositAmount = 1000;
      const longAmount = 100;
      await (await marginlyPool.connect(signer).depositBase(depositAmount, longAmount)).wait();

      // check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Long);
      expect(position.heapPosition).to.be.equal(1);
    });

    it('depositBase and long into short position should fail', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await (await marginlyPool.connect(lender).depositBase(10000, 0)).wait();

      const firstDeposit = 1000;
      const shortAmount = 200;
      await (await marginlyPool.connect(signer).depositQuote(firstDeposit, shortAmount)).wait();

      const baseDepositFirst = 10;
      const longAmount = 10;
      expect(marginlyPool.connect(signer).depositBase(baseDepositFirst, longAmount)).to.be.revertedWith('WPT');
    });

    it('depositBase should wrap ETH into WETH', async () => {
      const { marginlyPool, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();

      const depositAmount = 1000;
      await (await baseContract.connect(signer).approve(marginlyPool.address, 0)).wait();
      await (await marginlyPool.connect(signer).depositBase(depositAmount, 0, { value: depositAmount })).wait();

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

      expect(marginlyPool.connect(otherSigner).depositQuote(0, 0)).to.be.revertedWith('ZA');
    });

    it('exceeds limit', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, otherSigner] = await ethers.getSigners();

      expect(marginlyPool.connect(otherSigner).depositQuote(2_000_000, 0)).to.be.revertedWith('EL');
    });

    it('first deposit should create position', async () => {
      const { marginlyPool, quoteContract, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const depositAmount = 1500;

      const tx = await marginlyPool.connect(signer).depositQuote(depositAmount, 0);
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

      await (await marginlyPool.connect(signer).depositQuote(firstDeposit, 0)).wait();
      await (await marginlyPool.connect(signer).depositQuote(secondDeposit, 0)).wait();

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
      await (await marginlyPool.connect(lender).depositBase(10000, 0)).wait();

      const firstDeposit = 1000;
      await (await marginlyPool.connect(signer).depositQuote(firstDeposit, 0)).wait();
      const shortAmount = 200;
      await (await marginlyPool.connect(signer).short(shortAmount)).wait();

      const positionBefore = await marginlyPool.positions(signer.address);
      expect(positionBefore._type).to.be.equal(PositionType.Short);

      const quoteDeposit = 300;
      await (await marginlyPool.connect(signer).depositQuote(quoteDeposit, 0)).wait();

      const positionAfter = await marginlyPool.positions(signer.address);
      expect(positionAfter._type).to.be.equal(PositionType.Short);
    });

    it('deposit into long position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await (await marginlyPool.connect(lender).depositQuote(10000, 0)).wait();
      const firstDeposit = 1000;

      await (await marginlyPool.connect(signer).depositBase(firstDeposit, 0)).wait();
      const longAmount = 63;
      await (await marginlyPool.connect(signer).long(longAmount)).wait();

      const positionBefore = await marginlyPool.positions(signer.address);
      expect(positionBefore._type).to.be.equal(PositionType.Long);
      expect(positionBefore.heapPosition).to.be.equal(1);

      const quoteDepositSecond = 300;
      await (await marginlyPool.connect(signer).depositQuote(quoteDepositSecond, 0)).wait();

      const positionAfter = await marginlyPool.positions(signer.address);
      expect(positionAfter._type).to.be.equal(PositionType.Lend);
      expect(positionAfter.heapPosition).to.be.equal(0);
      expect((await marginlyPool.getLongHeapPosition(0))[0]).to.be.false;
    });

    it('depositQuote and open short position', async () => {
      const { marginlyPool, quoteContract, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();

      const lenderDeposit = 10000;
      await (await marginlyPool.connect(lender).depositBase(lenderDeposit, 0)).wait();

      const depositAmount = 1500;
      const shortAmount = 1000;
      await (await marginlyPool.connect(signer).depositQuote(depositAmount, shortAmount)).wait();

      // check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Short);
      expect(position.heapPosition).to.be.equal(1);
    });

    it('depositQuote and short into long position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await (await marginlyPool.connect(lender).depositQuote(10000, 0)).wait();
      const firstDeposit = 1000;
      const longAmount = 63;
      await (await marginlyPool.connect(signer).depositBase(firstDeposit, longAmount)).wait();

      const positionBefore = await marginlyPool.positions(signer.address);
      expect(positionBefore._type).to.be.equal(PositionType.Long);

      const quoteDepositSecond = 300;
      const shortAmount = 100;
      expect(marginlyPool.connect(signer).depositQuote(quoteDepositSecond, shortAmount)).to.be.revertedWith(
        'WPT'
      );
    });

    it('depositQuote and short into short position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await (await marginlyPool.connect(lender).depositBase(10000, 0)).wait();
      const firstDeposit = 1000;
      const shortAmount1 = 63;
      await (await marginlyPool.connect(signer).depositQuote(firstDeposit, shortAmount1)).wait();

      const positionBefore = await marginlyPool.positions(signer.address);
      expect(positionBefore._type).to.be.equal(PositionType.Short);

      const quoteDepositSecond = 300;
      const shortAmount2 = 100;
      await (await marginlyPool.connect(signer).depositQuote(quoteDepositSecond, shortAmount2)).wait();
      expect(positionBefore._type).to.be.equal(PositionType.Short);
    });

    it('depositQuote should wrap ETH to WETH', async () => {
      const { marginlyPool, quoteContract } = await loadFixture(createMarginlyPoolQuoteTokenIsWETH);
      const [_, signer] = await ethers.getSigners();

      const depositAmount = 1000;
      await quoteContract.connect(signer).approve(marginlyPool.address, 0);
      await (await marginlyPool.connect(signer).depositQuote(depositAmount, 0, { value: depositAmount })).wait();

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

      expect(marginlyPool.connect(signer).withdrawBase(0, false)).to.be.revertedWith('ZA');
    });

    it('should raise error when position not initialized', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer1, signer2] = await ethers.getSigners();
      const amountToDeposit = 654;
      await (await marginlyPool.connect(signer1).depositBase(amountToDeposit, 0)).wait();

      const amountToWithdraw = 89;
      expect(marginlyPool.connect(signer2).withdrawBase(amountToWithdraw, false)).to.be.revertedWith('U');
    });

    it('should decrease base position', async () => {
      const { marginlyPool, baseContract } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const amountToDeposit = 1000;
      await (await marginlyPool.connect(signer).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(signer).depositQuote(amountToDeposit, 0)).wait();

      const amountToWithdraw = 374;
      const tx = await marginlyPool.connect(signer).withdrawBase(amountToWithdraw, false);
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
      await (await marginlyPool.connect(signer).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(signer).depositQuote(amountToDeposit, 0)).wait();

      await (await marginlyPool.connect(signer).withdrawQuote(amountToDeposit, false)).wait();
      await (await marginlyPool.connect(signer).withdrawBase(amountToDeposit, false)).wait();

      //check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Uninitialized);
      expect(position.discountedBaseAmount).to.be.eq(0);
      expect(position.discountedQuoteAmount).to.be.eq(0);
    });

    it('withdrawBase should unwrap WETH to ETH', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();

      const params = await getMarginlyPoolParams(marginlyPool);
      await (await marginlyPool.setParameters({ ...params, baseLimit: BigNumber.from(1000n * 10n ** 18n) })).wait();

      const amountToDeposit = BigNumber.from(2n * 10n ** 18n); //2 ETH
      await (await marginlyPool.connect(signer).depositBase(amountToDeposit, 0)).wait();

      const balanceBefore = await signer.getBalance();
      const amountToWithdraw = BigNumber.from(2n * 10n ** 18n); //1 ETH
      const tx = await (await marginlyPool.connect(signer).withdrawBase(amountToWithdraw, true)).wait();
      const balanceAfter = await signer.getBalance();
      const txFee = await tx.gasUsed.mul(tx.effectiveGasPrice);

      expect(balanceBefore.sub(txFee).add(amountToWithdraw)).to.be.equal(balanceAfter);
    });
  });

  describe('Withdraw quote', () => {
    it('should raise error when trying to withdraw zero amount', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();

      expect(marginlyPool.connect(signer).withdrawQuote(0, false)).to.be.revertedWith('ZA');
    });

    it('should raise error when position not initialized', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer1, signer2] = await ethers.getSigners();
      const amountToDeposit = 543;
      await (await marginlyPool.connect(signer1).depositQuote(amountToDeposit, 0)).wait();

      const amountToWithdraw = 125;
      expect(marginlyPool.connect(signer2).withdrawQuote(amountToWithdraw, false)).to.be.revertedWith('U');
    });

    it('should decrease quote position', async () => {
      const { marginlyPool, quoteContract } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const amountToDeposit = 1000;
      await (await marginlyPool.connect(signer).depositQuote(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(signer).depositBase(amountToDeposit, 0)).wait();

      const amountToWithdraw = 589;
      const tx = await marginlyPool.connect(signer).withdrawQuote(amountToWithdraw, false);
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
      const { marginlyPool } = await loadFixture(createTimeMoveMarginlyPool);
      const [_, user1, user2] = await ethers.getSigners();
      const timeShift = 300 * 24 * 60 * 60;
      const one = BigNumber.from(FP96.one);
      const interestRateX96 = BigNumber.from((await getMarginlyPoolParams(marginlyPool)).interestRate)
        .mul(one)
        .div(1e6);
      const year = BigNumber.from(365.25 * 24 * 60 * 60).mul(one);

      const user1BaseDeposit = 100;
      const user1LongAmount = 6;

      const user2QuoteDeposit = 1000;
      const user2ShortAmount = 20;

      await (await marginlyPool.connect(user1).depositBase(user1BaseDeposit, 0)).wait();
      await (await marginlyPool.connect(user2).depositQuote(user2QuoteDeposit, 0)).wait();

      await (await marginlyPool.connect(user1).long(user1LongAmount)).wait();
      await (await marginlyPool.connect(user2).short(user2ShortAmount)).wait();

      const baseDebtCoeffBefore = await marginlyPool.baseDebtCoeff();
      const quoteDebtCoeffBefore = await marginlyPool.quoteDebtCoeff();
      const systemLeverage = await marginlyPool.systemLeverage();
      const leverageShort = systemLeverage.shortX96;
      const leverageLong = systemLeverage.longX96;
      const lastReinitTimestampBefore = await marginlyPool.lastReinitTimestampSeconds();

      await increatePoolTimestamp(marginlyPool, timeShift);
      await (await marginlyPool.reinit()).wait();

      const lastReinitTimestamp = await marginlyPool.lastReinitTimestampSeconds();
      const secondsPassed = lastReinitTimestamp.sub(lastReinitTimestampBefore);

      const baseDebtCoeffMul = powTaylor(leverageShort.mul(interestRateX96).div(year).add(one), +secondsPassed);
      const quoteDebtCoeffMul = powTaylor(leverageLong.mul(interestRateX96).div(year).add(one), +secondsPassed);

      const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
      const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();

      expect(baseDebtCoeffBefore.mul(baseDebtCoeffMul).div(one)).to.be.eq(baseDebtCoeff);
      expect(quoteDebtCoeffBefore.mul(quoteDebtCoeffMul).div(one)).to.be.eq(quoteDebtCoeff);
    });

    it('withdraw with position removing', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer] = await ethers.getSigners();
      const amountToDeposit = 1000;
      await (await marginlyPool.connect(signer).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(signer).depositQuote(amountToDeposit, 0)).wait();

      await (await marginlyPool.connect(signer).withdrawBase(amountToDeposit, false)).wait();
      await (await marginlyPool.connect(signer).withdrawQuote(amountToDeposit, false)).wait();

      //check position
      const position = await marginlyPool.positions(signer.address);
      expect(position._type).to.be.equal(PositionType.Uninitialized);
      expect(position.discountedBaseAmount).to.be.eq(0);
      expect(position.discountedQuoteAmount).to.be.eq(0);
    });

    it('withdrawQuote should unwrap WETH to ETH', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPoolQuoteTokenIsWETH);
      const [_, signer] = await ethers.getSigners();

      const params = await getMarginlyPoolParams(marginlyPool);
      await (await marginlyPool.setParameters({ ...params, quoteLimit: BigNumber.from(1000n * 10n ** 18n) })).wait();

      const amountToDeposit = BigNumber.from(2n * 10n ** 18n); //2 ETH
      await (await marginlyPool.connect(signer).depositQuote(amountToDeposit, 0)).wait();

      const balanceBefore = await signer.getBalance();
      const amountToWithdraw = BigNumber.from(2n * 10n ** 18n); //1 ETH
      const tx = await (await marginlyPool.connect(signer).withdrawQuote(amountToWithdraw, true)).wait();
      const balanceAfter = await signer.getBalance();
      const txFee = await tx.gasUsed.mul(tx.effectiveGasPrice);

      expect(balanceBefore.sub(txFee).add(amountToWithdraw)).to.be.equal(balanceAfter);
    });
  });

  describe('Close position', () => {
    it('should raise error when attempt to close Uninitialized', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      expect(marginlyPool.closePosition()).to.be.revertedWith('U');
    });

    it('should raise error when attempt to close Lend position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [, signer] = await ethers.getSigners();

      const amountToDeposit = 1000;
      await (await marginlyPool.connect(signer).depositQuote(amountToDeposit, 0)).wait();
      expect(marginlyPool.connect(signer).closePosition()).to.be.revertedWith('L');
    });

    it('should close short position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, signer, lender] = await ethers.getSigners();
      await (await marginlyPool.connect(lender).depositBase(1000, 0)).wait();

      const amountToDeposit = 1000;
      const amountOfShort = 100;

      await (await marginlyPool.connect(signer).depositQuote(amountToDeposit, amountOfShort)).wait();

      {
        const position = await marginlyPool.positions(signer.address);
        expect(position._type).to.be.equal(PositionType.Short);
      }

      await (await marginlyPool.connect(signer).closePosition()).wait();
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
      await (await marginlyPool.connect(lender).depositQuote(1000, 0)).wait();

      const amountToDeposit = 1000;
      const amountOfLong = 63;

      await (await marginlyPool.connect(signer).depositBase(amountToDeposit, amountOfLong)).wait();

      await (await marginlyPool.connect(signer).closePosition()).wait();
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
      await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();

      const shortAmount = 1000;
      expect(marginlyPool.connect(shorter).short(shortAmount)).to.be.revertedWith('WPT');

      await (await marginlyPool.connect(shorter).depositQuote(amountToDeposit, shortAmount)).wait();

      await (await marginlyPool.connect(shorter).depositBase(amountToDeposit, 0)).wait();
      expect(marginlyPool.connect(shorter).short(shortAmount)).to.be.revertedWith('WPT');
    });

    it('short minAmount violation', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter, depositor] = await ethers.getSigners();
      const amountToDeposit = 10000;
      await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();

      const shortAmount = 1;
      await (await marginlyPool.connect(shorter).depositQuote(amountToDeposit, 0)).wait();
      expect(marginlyPool.connect(shorter).short(shortAmount)).to.be.rejectedWith('MA');
    });

    it('exceeds limit', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter, depositor] = await ethers.getSigners();
      const amountToDeposit = 450_000;
      const basePrice = (await marginlyPool.getBasePrice()).inner;
      const shortAmount = BigNumber.from(200_000).mul(FP96.one).div(basePrice);

      await (await marginlyPool.connect(depositor).depositBase(shortAmount, 0)).wait();
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(shorter).depositQuote(amountToDeposit, 0)).wait();

      // 450 + 450 + 200 > 1000
      expect(marginlyPool.connect(shorter).short(shortAmount)).to.be.revertedWith('EL');
    });

    it('short should update leverageShort', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter, depositor] = await ethers.getSigners();
      const amountToDeposit = 10000;
      await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();

      const shortAmount = 1000;
      await (await marginlyPool.connect(shorter).depositQuote(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(shorter).short(shortAmount)).wait();

      const basePrice = await marginlyPool.getBasePrice();
      const position = await marginlyPool.positions(shorter.address);
      const shortHeapPositionKey = (await marginlyPool.getShortHeapPosition(position.heapPosition - 1))[1].key;

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
      const params = await getMarginlyPoolParams(marginlyPool);
      await (await marginlyPool.setParameters({ ...params, swapFee: 500_000 })).wait();
      const amountToDeposit = 10000;
      await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(shorter).depositQuote(amountToDeposit, 0)).wait();

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
      await (await marginlyPool.connect(shorter).short(shortAmount)).wait();

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
      const params = await getMarginlyPoolParams(marginlyPool);
      await (await marginlyPool.setParameters({ ...params, swapFee: 500_000 })).wait();
      const one = BigNumber.from(FP96.one);
      const amountToDeposit = 10000;
      await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(shorter).depositQuote(amountToDeposit, 0)).wait();

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
      await (await marginlyPool.connect(shorter).short(shortAmount)).wait();

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
      await (await marginlyPool.connect(shorter).short(shortAmount2)).wait();

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
      await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();

      const longAmount = 1000;
      expect(marginlyPool.connect(longer).long(longAmount)).to.be.revertedWith('U');
    });

    it('long minAmount violation', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, longer, depositor] = await ethers.getSigners();
      const amountToDeposit = 10000;
      await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();

      const shortAmount = 1;
      await (await marginlyPool.connect(longer).depositBase(amountToDeposit, 0)).wait();
      expect(marginlyPool.connect(longer).long(shortAmount)).to.be.rejectedWith('MA');
    });

    it('exceeds limit', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, longer, depositor] = await ethers.getSigners();
      const amountToDeposit = 400_000;

      await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(longer).depositBase(amountToDeposit, 0)).wait();

      expect(marginlyPool.connect(longer).long(amountToDeposit)).to.be.revertedWith('EL');
    });

    it('long should update leverageLong', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, longer, depositor] = await ethers.getSigners();
      const amountToDeposit = 10000;
      await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();

      const shortAmount = 1000;
      await (await marginlyPool.connect(longer).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(longer).long(shortAmount)).wait();

      const position = await marginlyPool.positions(longer.address);
      const basePrice = await marginlyPool.getBasePrice();
      const initialPrice = await marginlyPool.initialPrice();

      const longHeapPositionKey = (await marginlyPool.getLongHeapPosition(position.heapPosition - 1))[1].key;

      const expectedSortKey = calcLongSortKey(
        initialPrice,
        position.discountedQuoteAmount,
        position.discountedBaseAmount
      );

      expect(longHeapPositionKey).to.be.equal(expectedSortKey);
      const leverageLong = (await marginlyPool.systemLeverage()).longX96;
      const expectedLeverageLong = calcLeverageLong(
        basePrice.inner,
        await marginlyPool.quoteCollateralCoeff(),
        await marginlyPool.baseDebtCoeff(),
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
      const params = await getMarginlyPoolParams(marginlyPool);
      await (await marginlyPool.setParameters({ ...params, swapFee: 100_000 })).wait();
      const amountToDeposit = 100000;
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(longer).depositBase(amountToDeposit, 0)).wait();

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
      await (await marginlyPool.connect(longer).long(longAmount)).wait();

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
        await marginlyPool.quoteCollateralCoeff(),
        await marginlyPool.baseDebtCoeff(),
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
      const params = await getMarginlyPoolParams(marginlyPool);
      await (await marginlyPool.setParameters({ ...params, swapFee: 100_000 })).wait();
      const amountToDeposit = 10000;
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(longer).depositBase(amountToDeposit, 0)).wait();

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
      await (await marginlyPool.connect(longer).long(longAmount)).wait();

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
        await marginlyPool.quoteCollateralCoeff(),
        await marginlyPool.baseDebtCoeff(),
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
      await (await marginlyPool.connect(longer).long(longAmount2)).wait();

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
        await marginlyPool.quoteCollateralCoeff(),
        await marginlyPool.baseDebtCoeff(),
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
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(longer1).depositBase(amountToDeposit, 0)).wait();

      const amountToLong = 250;
      await (await marginlyPool.connect(longer1).long(amountToLong)).wait();

      const position1 = await marginlyPool.positions(longer1.address);
      const [success, node] = await marginlyPool.getLongHeapPosition(position1.heapPosition - 1);
      expect(success).to.be.true;

      const longSortKeyX48 = node.key;

      const initialPrice = await marginlyPool.initialPrice();

      const expectedLongSortKeyX48 = position1.discountedQuoteAmount
        .mul(FP48.Q48)
        .div(initialPrice.mul(position1.discountedBaseAmount).div(FP96.one));

      expect(longSortKeyX48).to.be.equal(expectedLongSortKeyX48);
    });

    it('should properly calculate sort key for short position', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter1, depositor] = await ethers.getSigners();

      const amountToDeposit = 10000;
      await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();
      await (await marginlyPool.connect(shorter1).depositQuote(amountToDeposit, 0)).wait();

      const amountToLong = 25;
      await (await marginlyPool.connect(shorter1).short(amountToLong)).wait();

      const position1 = await marginlyPool.positions(shorter1.address);
      const [success, node] = await marginlyPool.getShortHeapPosition(position1.heapPosition - 1);
      expect(success).to.be.true;

      const shortSortKeyX48 = node.key;

      const initialPrice = await marginlyPool.initialPrice();

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
      await (await marginlyPool.connect(depositor).depositQuote(amountToDeposit, 0)).wait();

      const longAmount1 = 10;
      await (await marginlyPool.connect(longer1).depositBase(amountToDeposit, longAmount1)).wait();

      const longAmount2 = 25;
      await (await marginlyPool.connect(longer2).depositBase(amountToDeposit, longAmount2)).wait();

      const position1 = await marginlyPool.positions(longer1.address);
      const position2 = await marginlyPool.positions(longer2.address);

      expect(position2.heapPosition).to.be.lessThan(position1.heapPosition);
    });

    it('short position sortKey', async () => {
      const { marginlyPool } = await loadFixture(createMarginlyPool);
      const [_, shorter1, shorter2, shorter3, depositor] = await ethers.getSigners();

      const amountToDeposit = 10000;
      await (await marginlyPool.connect(depositor).depositBase(amountToDeposit, 0)).wait();

      const shortAmount1 = 10;
      await (await marginlyPool.connect(shorter1).depositQuote(amountToDeposit, shortAmount1)).wait();

      const shortAmount2 = 25;
      await (await marginlyPool.connect(shorter2).depositQuote(amountToDeposit, shortAmount2)).wait();
      await (await marginlyPool.connect(shorter3).depositQuote(amountToDeposit, 0)).wait();

      let position1 = await marginlyPool.positions(shorter1.address);
      let position2 = await marginlyPool.positions(shorter2.address);

      expect(position2.heapPosition).to.be.lessThan(position1.heapPosition);

      const shortAmount3 = 45;
      await (await marginlyPool.connect(shorter3).short(shortAmount3)).wait();

      position1 = await marginlyPool.positions(shorter1.address);
      position2 = await marginlyPool.positions(shorter2.address);
      const position3 = await marginlyPool.positions(shorter3.address);

      expect(position1.heapPosition).to.be.equal(2);
      expect(position2.heapPosition).to.be.equal(3);
      expect(position3.heapPosition).to.be.equal(1);
    });
  });
});
