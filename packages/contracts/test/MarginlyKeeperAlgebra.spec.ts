import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { createMarginlyKeeperAlgebra } from './shared/fixtures';
import { PositionType } from './shared/utils';

const keeperSwapCallData = 0n; // it's ok for unit tests, but it wont work in production

function encodeLiquidationParams(
  asset: string,
  amount: bigint,
  marginlyPool: string,
  positionToLiquidate: string,
  liquidator: string,
  algebraPool: string,
  minProfit: bigint,
  swapCallData: bigint
): string {
  /**
   *  address asset;
    uint256 amount;
    address marginlyPool;
    address positionToLiquidate;
    address liquidator;
    address algebraPool;
    uint256 minProfit;
    uint256 swapCallData;
   */

  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256', 'address', 'address', 'address', 'address', 'uint256', 'uint256'],
    [asset, amount, marginlyPool, positionToLiquidate, liquidator, algebraPool, minProfit, swapCallData]
  );
}

describe('MarginlyKeeperAlgebra', () => {
  it('Should liquidate short bad position', async () => {
    const { keeper, swapRouter, baseToken, marginlyPool, algebraPool } = await loadFixture(createMarginlyKeeperAlgebra);
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
    await marginlyPool.setBadPosition(badPosition.address, quoteAmount, baseAmount, PositionType.Short);

    const minProfitETH = 1n * 10n ** (decimals - 2n); // 0.01 ETH

    const balanceBefore = await baseToken.balanceOf(liquidator.address);

    const [amount0, amount1] = (await algebraPool.token0()) == baseToken.address ? [baseAmount, 0] : [0, baseAmount];
    const flashCalldata = encodeLiquidationParams(
      baseToken.address,
      baseAmount,
      marginlyPool.address,
      badPosition.address,
      liquidator.address,
      algebraPool.address,
      minProfitETH,
      keeperSwapCallData
    );

    await keeper.connect(liquidator).liquidatePosition(algebraPool.address, amount0, amount1, flashCalldata);

    const balanceAfter = await baseToken.balanceOf(liquidator.address);

    expect(balanceAfter).greaterThanOrEqual(balanceBefore.add(BigNumber.from(minProfitETH)));
  });

  it('Should liquidate long position', async () => {
    const { keeper, swapRouter, baseToken, quoteToken, marginlyPool, algebraPool } = await loadFixture(
      createMarginlyKeeperAlgebra
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
    await marginlyPool.setBadPosition(badPosition.address, quoteAmount, baseAmount, PositionType.Long);

    const minProfitETH = 100n * 10n ** decimals; // 100 USDC

    const balanceBefore = await quoteToken.balanceOf(liquidator.address);

    const [amount0, amount1] = (await algebraPool.token0()) == quoteToken.address ? [quoteAmount, 0] : [0, quoteAmount];
    const liquidationParams = encodeLiquidationParams(
      quoteToken.address,
      quoteAmount,
      marginlyPool.address,
      badPosition.address,
      liquidator.address,
      algebraPool.address,
      minProfitETH,
      keeperSwapCallData
    );

    await keeper.connect(liquidator).liquidatePosition(algebraPool.address, amount0, amount1, liquidationParams);

    const balanceAfter = await quoteToken.balanceOf(liquidator.address);

    expect(balanceAfter).greaterThanOrEqual(balanceBefore.add(BigNumber.from(minProfitETH)));
  });

  it('Should fail when profit after liquidation less than minimum', async () => {
    const { keeper, swapRouter, baseToken, quoteToken, marginlyPool, algebraPool } = await loadFixture(
      createMarginlyKeeperAlgebra
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
    await marginlyPool.setBadPosition(badPosition.address, quoteAmount, baseAmount, PositionType.Long);

    const minProfitETH = 500n * 10n ** decimals; // 500 USDC

    const [amount0, amount1] = (await algebraPool.token0()) == quoteToken.address ? [quoteAmount, 0] : [0, quoteAmount];
    const liquidationParams = encodeLiquidationParams(
      quoteToken.address,
      quoteAmount,
      marginlyPool.address,
      badPosition.address,
      liquidator.address,
      algebraPool.address,
      minProfitETH,
      keeperSwapCallData
    );

    await expect(
      keeper.connect(liquidator).liquidatePosition(algebraPool.address, amount0, amount1, liquidationParams)
    ).to.be.revertedWith('Less than minimum profit');
  });
});
