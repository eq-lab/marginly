import { createMarginlyPool } from './shared/fixtures';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { CallType, FP96, PositionType, uniswapV3Swapdata, ZERO_ADDRESS } from './shared/utils';
import { BigNumber } from 'ethers';

describe('MarginlyPool.Manager', () => {
  it('manager long + close', async () => {
    const { marginlyPool, manager, quoteContract } = await loadFixture(createMarginlyPool);
    const [_, user, lender] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    const params = await marginlyPool.params();
    const managerFee = params.managerFee;

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 10000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 10000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(user)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    let managerBalanceBefore = await quoteContract.balanceOf(manager.address);

    const discountedQuoteDebtInitial = await marginlyPool.discountedQuoteDebt();
    const posQuoteDebtInitial = (await marginlyPool.positions(user.address)).discountedQuoteAmount;

    const longAmount = BigNumber.from(1000);
    await marginlyPool
      .connect(manager)
      .execute(CallType.Long, longAmount, 0, price, false, user.address, uniswapV3Swapdata());

    let managerBalanceCurrent = await quoteContract.balanceOf(manager.address);
    const positionAfterLong = await marginlyPool.positions(user.address);
    const managerPositionAfterLong = await marginlyPool.positions(manager.address);

    expect(positionAfterLong._type).to.be.eq(PositionType.Long);
    expect(managerPositionAfterLong._type).to.be.eq(PositionType.Uninitialized);
    expect(managerBalanceCurrent.sub(managerBalanceBefore)).to.be.eq(managerFee);
    managerBalanceBefore = managerBalanceCurrent;

    const quoteDebtCoeffAfterLong = await marginlyPool.quoteDebtCoeff();
    const discountedBaseCollAfterLong = await marginlyPool.discountedBaseCollateral();
    const discountedQuoteDebtAfterLong = await marginlyPool.discountedQuoteDebt();
    const posQuoteDebtAfterLong = positionAfterLong.discountedQuoteAmount;

    const expectedDiscountedQuoteDebtDelta = longAmount
      .mul(price)
      .div(FP96.one)
      .mul(1e6 + params.swapFee)
      .div(1e6)
      .add(managerFee)
      .mul(FP96.one)
      .div(quoteDebtCoeffAfterLong);

    expect(discountedQuoteDebtAfterLong.sub(discountedQuoteDebtInitial)).to.be.closeTo(
      expectedDiscountedQuoteDebtDelta,
      1
    );
    expect(posQuoteDebtAfterLong.sub(posQuoteDebtInitial)).to.be.closeTo(expectedDiscountedQuoteDebtDelta, 1);

    await marginlyPool
      .connect(manager)
      .execute(CallType.ClosePosition, 0, 0, price, false, user.address, uniswapV3Swapdata());

    managerBalanceCurrent = await quoteContract.balanceOf(manager.address);
    const positionAfterClose = await marginlyPool.positions(user.address);
    const managerPositionAfterClose = await marginlyPool.positions(manager.address);

    expect(positionAfterClose._type).to.be.eq(PositionType.Lend);
    expect(managerPositionAfterClose._type).to.be.eq(PositionType.Uninitialized);
    expect(managerBalanceCurrent.sub(managerBalanceBefore)).to.be.eq(managerFee);

    const quoteDebtCoeffAfterClose = await marginlyPool.quoteDebtCoeff();
    const baseCollCoeffAfterClose = await marginlyPool.baseCollateralCoeff();
    const discountedBaseCollAfterClose = await marginlyPool.discountedBaseCollateral();
    const posBaseCollAfterClose = positionAfterClose.discountedBaseAmount;

    const expectedDiscountedBaseCollDelta = posQuoteDebtAfterLong
      .mul(quoteDebtCoeffAfterClose)
      .div(FP96.one)
      .mul(1e6 + params.swapFee)
      .div(1e6)
      .add(managerFee.add(1)) // + 1 because of precision issues
      .mul(FP96.one)
      .div(price)
      .mul(FP96.one)
      .div(baseCollCoeffAfterClose);

    expect(discountedBaseCollAfterLong.sub(discountedBaseCollAfterClose)).to.be.closeTo(
      expectedDiscountedBaseCollDelta,
      1
    );
    expect(positionAfterLong.discountedBaseAmount.sub(posBaseCollAfterClose)).to.be.closeTo(
      expectedDiscountedBaseCollDelta, 
      1
    );
  });

  it('manager short + close', async () => {
    const { marginlyPool, manager, quoteContract } = await loadFixture(createMarginlyPool);
    const [_, user, lender] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;
    const params = await marginlyPool.params();
    const managerFee = params.managerFee;

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 10000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 10000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(user)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    let managerBalanceBefore = await quoteContract.balanceOf(manager.address);

    const discountedQuoteCollateralInitial = await marginlyPool.discountedQuoteCollateral();
    const posQuoteCollInitial = (await marginlyPool.positions(user.address)).discountedQuoteAmount;

    const shortAmount = BigNumber.from(1000);
    await marginlyPool
      .connect(manager)
      .execute(CallType.Short, shortAmount, 0, price, false, user.address, uniswapV3Swapdata());

    let managerBalanceCurrent = await quoteContract.balanceOf(manager.address);
    const positionAfterShort = await marginlyPool.positions(user.address);
    const managerPositionAfterShort = await marginlyPool.positions(manager.address);

    expect(positionAfterShort._type).to.be.eq(PositionType.Short);
    expect(managerPositionAfterShort._type).to.be.eq(PositionType.Uninitialized);
    expect(managerBalanceCurrent.sub(managerBalanceBefore)).to.be.eq(managerFee);
    managerBalanceBefore = managerBalanceCurrent;

    const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
    const discountedQuoteCollateralAfterShort = await marginlyPool.discountedQuoteCollateral();
    const posQuoteCollAfterShort = positionAfterShort.discountedQuoteAmount;

    const expectedDiscountedQuoteCollateral = shortAmount
      .mul(price)
      .div(FP96.one)
      .mul(1e6 - params.swapFee)
      .div(1e6)
      .sub(managerFee)
      .mul(FP96.one)
      .div(quoteCollateralCoeff);

    expect(discountedQuoteCollateralAfterShort.sub(discountedQuoteCollateralInitial)).to.be.closeTo(
      expectedDiscountedQuoteCollateral,
      1
    );
    expect(posQuoteCollAfterShort.sub(posQuoteCollInitial)).to.be.closeTo(expectedDiscountedQuoteCollateral, 1);

    await marginlyPool
      .connect(manager)
      .execute(CallType.ClosePosition, 0, 0, price, false, user.address, uniswapV3Swapdata());

    managerBalanceCurrent = await quoteContract.balanceOf(manager.address);
    const positionAfterClose = await marginlyPool.positions(user.address);
    const managerPositionAfterClose = await marginlyPool.positions(manager.address);

    expect(positionAfterClose._type).to.be.eq(PositionType.Lend);
    expect(managerPositionAfterClose._type).to.be.eq(PositionType.Uninitialized);

    const quoteCollCoeffAfterClose = await marginlyPool.quoteCollateralCoeff();
    const baseDebtCoeffAfterClose = await marginlyPool.baseDebtCoeff();
    const discountedQuoteCollateralAfterClose = await marginlyPool.discountedQuoteCollateral();
    const posQuoteCollAfterClose = positionAfterClose.discountedQuoteAmount;

    const expectedDiscountedQuoteCollDelta = positionAfterShort.discountedBaseAmount
      .mul(baseDebtCoeffAfterClose)
      .div(FP96.one)
      .mul(price)
      .div(FP96.one)
      .mul(1e6 + params.swapFee)
      .div(1e6)
      .add(managerFee)
      .mul(FP96.one)
      .div(quoteCollCoeffAfterClose);

    expect(discountedQuoteCollateralAfterShort.sub(discountedQuoteCollateralAfterClose)).to.be.closeTo(
      expectedDiscountedQuoteCollDelta, 
      1
    );
    expect(positionAfterShort.discountedQuoteAmount.sub(posQuoteCollAfterClose)).to.be.closeTo(
      expectedDiscountedQuoteCollDelta,
      1
    );
  });

  it('manager forbidden actions', async () => {
    const { marginlyPool, manager } = await loadFixture(createMarginlyPool);
    const [_, user, lender] = await ethers.getSigners();
    const price = (await marginlyPool.getBasePrice()).inner;

    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositBase, 10000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(lender)
      .execute(CallType.DepositQuote, 10000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(user)
      .execute(CallType.DepositQuote, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());
    await marginlyPool
      .connect(user)
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await expect(
      marginlyPool
        .connect(manager)
        .execute(CallType.DepositBase, 1000, 0, price, false, user.address, uniswapV3Swapdata())
    ).to.be.revertedWithCustomError(marginlyPool, 'Forbidden');

    await expect(
      marginlyPool
        .connect(manager)
        .execute(CallType.DepositQuote, 1000, 0, price, false, user.address, uniswapV3Swapdata())
    ).to.be.revertedWithCustomError(marginlyPool, 'Forbidden');

    await expect(
      marginlyPool
        .connect(manager)
        .execute(CallType.WithdrawBase, 1000, 0, price, false, user.address, uniswapV3Swapdata())
    ).to.be.revertedWithCustomError(marginlyPool, 'Forbidden');

    await expect(
      marginlyPool
        .connect(manager)
        .execute(CallType.WithdrawQuote, 1000, 0, price, false, user.address, uniswapV3Swapdata())
    ).to.be.revertedWithCustomError(marginlyPool, 'Forbidden');
  });
});
