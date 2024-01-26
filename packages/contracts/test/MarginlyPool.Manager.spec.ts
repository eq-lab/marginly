import { createMarginlyPool } from './shared/fixtures';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { CallType, PositionType, uniswapV3Swapdata, ZERO_ADDRESS } from './shared/utils';

describe.only('MarginlyPool.Manager', () => {
  it('manager long + close', async () => {
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
      .execute(CallType.DepositBase, 1000, 0, price, false, ZERO_ADDRESS, uniswapV3Swapdata());

    await marginlyPool
      .connect(manager)
      .execute(CallType.Long, 1000, 0, price, false, user.address, uniswapV3Swapdata());

    const positionAfterLong = await marginlyPool.positions(user.address);
    const managerPositionAfterLong = await marginlyPool.positions(manager.address);

    expect(positionAfterLong._type).to.be.eq(PositionType.Long);
    expect(managerPositionAfterLong._type).to.be.eq(PositionType.Uninitialized);

    await marginlyPool
      .connect(manager)
      .execute(CallType.ClosePosition, 0, 0, price, false, user.address, uniswapV3Swapdata());

    const positionAfterClose = await marginlyPool.positions(user.address);
    const managerPositionAfterClose = await marginlyPool.positions(manager.address);

    expect(positionAfterClose._type).to.be.eq(PositionType.Lend);
    expect(managerPositionAfterClose._type).to.be.eq(PositionType.Uninitialized);
  });

  it('manager short + close', async () => {
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
      .connect(manager)
      .execute(CallType.Short, 1000, 0, price, false, user.address, uniswapV3Swapdata());

    const positionAfterShort = await marginlyPool.positions(user.address);
    const managerPositionAfterShort = await marginlyPool.positions(manager.address);

    expect(positionAfterShort._type).to.be.eq(PositionType.Short);
    expect(managerPositionAfterShort._type).to.be.eq(PositionType.Uninitialized);

    await marginlyPool
      .connect(manager)
      .execute(CallType.ClosePosition, 0, 0, price, false, user.address, uniswapV3Swapdata());

    const positionAfterClose = await marginlyPool.positions(user.address);
    const managerPositionAfterClose = await marginlyPool.positions(manager.address);

    expect(positionAfterClose._type).to.be.eq(PositionType.Lend);
    expect(managerPositionAfterClose._type).to.be.eq(PositionType.Uninitialized);
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
