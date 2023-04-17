import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { createMarginlyKeeperContract } from './shared/fixtures';

const shortPositionType = 2;
const longPositionType = 3;

describe('MarginlyKeeper', () => {
  it('Should liquidate short bad position', async () => {
    const { marginlyKeeper, swapRouter, baseToken, marginlyPool } = await loadFixture(createMarginlyKeeperContract);
    const [, badPosition, liquidator] = await ethers.getSigners();
    const decimals = BigInt(await baseToken.decimals());
    const price = 1500; // 1 ETH = 1500 USDC
    await swapRouter.setExchangePrice(price);

    /**
     * Bad position:
     * depositQuote 100 USDC, short 1.2 ETH
     * after:
     * quote amount =  1900 USDC
     * base amount =  1.2 ETH
     * leverage = 1900 / (1900-1800) = 19
     */

    const quoteAmount = 1900n * 10n ** decimals; // 1900 USDC - collateral
    const baseAmount = 12n * 10n ** (decimals - 1n); // 1.2 ETH - debt

    //borrow asset = baseToken
    await marginlyPool.setBadPosition(badPosition.address, quoteAmount, baseAmount, shortPositionType);

    const minProfitETH = 1n * 10n ** (decimals - 2n); // 0.01 ETH
    const referralCode = 0;

    const balanceBefore = await baseToken.balanceOf(liquidator.address);

    await marginlyKeeper
      .connect(liquidator)
      .flashLoan(
        await marginlyPool.baseToken(),
        baseAmount,
        referralCode,
        marginlyPool.address,
        badPosition.address,
        minProfitETH
      );

    const balanceAfter = await baseToken.balanceOf(liquidator.address);

    expect(balanceAfter).greaterThanOrEqual(balanceBefore.add(BigNumber.from(minProfitETH)));
  });

  it('Should liquidate long position', async () => {
    const { marginlyKeeper, swapRouter, baseToken, quoteToken, marginlyPool } = await loadFixture(
      createMarginlyKeeperContract
    );
    const [, badPosition, liquidator] = await ethers.getSigners();
    const decimals = BigInt(await baseToken.decimals());
    const price = 1500; // 1 ETH = 1500 USDC
    await swapRouter.setExchangePrice(price);

    /**
     * Bad position:
     * depositBase 0.1 ETH, short 1.8 ETH
     * after:
     * quote amount =  1.8 * 1500 = 2700 USDC
     * base amount =  1.9 ETH
     * leverage = 1.9 * 1500 / (1.9 * 1500 - 1.8 * 1500) = 19
     */

    const quoteAmount = 2700n * 10n ** decimals; // 2700 USDC - collateral
    const baseAmount = 19n * 10n ** (decimals - 1n); // 1.9 ETH - debt

    //borrow asset = baseToken
    await marginlyPool.setBadPosition(badPosition.address, quoteAmount, baseAmount, longPositionType);

    const minProfitETH = 100n * 10n ** decimals; // 100 USDC
    const referralCode = 0;

    const balanceBefore = await quoteToken.balanceOf(liquidator.address);

    await marginlyKeeper
      .connect(liquidator)
      .flashLoan(
        await marginlyPool.quoteToken(),
        quoteAmount,
        referralCode,
        marginlyPool.address,
        badPosition.address,
        minProfitETH
      );

    const balanceAfter = await quoteToken.balanceOf(liquidator.address);

    expect(balanceAfter).greaterThanOrEqual(balanceBefore.add(BigNumber.from(minProfitETH)));
  });

  it('Should fail when profit after liquidation less than minimum', async () => {
    const { marginlyKeeper, swapRouter, baseToken, marginlyPool } = await loadFixture(createMarginlyKeeperContract);
    const [, badPosition, liquidator] = await ethers.getSigners();
    const decimals = BigInt(await baseToken.decimals());
    const price = 1500; // 1 ETH = 1500 USDC
    await swapRouter.setExchangePrice(price);

    /**
     * Bad position:
     * depositBase 0.1 ETH, short 1.8 ETH
     * after:
     * quote amount =  1.8 * 1500 = 2700 USDC
     * base amount =  1.9 ETH
     * leverage = 1.9 * 1500 / (1.9 * 1500 - 1.8 * 1500) = 19
     */

    const quoteAmount = 2700n * 10n ** decimals; // 2700 USDC - collateral
    const baseAmount = 19n * 10n ** (decimals - 1n); // 1.9 ETH - debt

    //borrow asset = baseToken
    await marginlyPool.setBadPosition(badPosition.address, quoteAmount, baseAmount, longPositionType);

    const minProfitETH = 500n * 10n ** decimals; // 500 USDC
    const referralCode = 0;

    await expect(
      marginlyKeeper
        .connect(liquidator)
        .flashLoan(
          await marginlyPool.quoteToken(),
          quoteAmount,
          referralCode,
          marginlyPool.address,
          badPosition.address,
          minProfitETH
        )
    ).to.be.revertedWith('Less than minimum profit');
  });
});
