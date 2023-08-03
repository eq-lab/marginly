import assert = require('assert');
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { logger } from '../utils/logger';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { ZERO_ADDRESS } from '../utils/const';

export async function routerSwaps(sut: SystemUnderTest) {
  logger.info(`Starting shortIncome test suite`);
  const { treasury, usdc, weth, swapRouter } = sut;

  let currentWethBalance = await weth.balanceOf(treasury.address);
  let currentUsdcBalance = await usdc.balanceOf(treasury.address);

  const wethAmount = parseUnits('0.01', 18);
  const usdcAmount = parseUnits('10', 6);

  for(let dexNumber = 0; dexNumber < 9; ++dexNumber) {
    const dexPoolAddress = await swapRouter.dexPoolMapping(dexNumber, weth.address, usdc.address);
    if(dexPoolAddress == ZERO_ADDRESS) continue;
    logger.info(`Testing ${dexNumber} dex`);

    const dex = defaultAbiCoder.encode(['uint'], [dexNumber]);

    {
      logger.info(`Testing swapExactOutput`);
      const oldWethBalance = currentWethBalance;
      const oldUsdcBalance = currentUsdcBalance;

      const oldPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const oldPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      await weth.connect(treasury).approve(swapRouter.address, wethAmount);
      await (
        await swapRouter.swapExactOutput(
          dex, weth.address, usdc.address, wethAmount, usdcAmount, { gasLimit: 1_000_000 }
        )
      ).wait();

      currentWethBalance = await weth.balanceOf(treasury.address);
      currentUsdcBalance = await usdc.balanceOf(treasury.address);

      const currentPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const currentPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      logger.info(`Checking weth balances`);
      const poolWethDelta = currentPoolWethBalance.sub(oldPoolWethBalance);
      const wethDelta = oldWethBalance.sub(currentWethBalance);
      assert(wethDelta.eq(poolWethDelta));

      logger.info(`Checking usdc balances`);
      const poolUsdcDelta = currentPoolUsdcBalance.sub(oldPoolUsdcBalance);
      const usdcDelta = oldUsdcBalance.sub(currentUsdcBalance);
      assert(usdcDelta.eq(poolUsdcDelta));
    }

    {
      logger.info(`Testing swapExactInput`);
      const oldWethBalance = currentWethBalance;
      const oldUsdcBalance = currentUsdcBalance;

      const oldPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const oldPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      await weth.connect(treasury).approve(swapRouter.address, wethAmount);
      await (
        await swapRouter.swapExactInput(
          dex, weth.address, usdc.address, wethAmount, 0, { gasLimit: 1_000_000 }
        )
      ).wait();

      currentWethBalance = await weth.balanceOf(treasury.address);
      currentUsdcBalance = await usdc.balanceOf(treasury.address);

      const currentPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const currentPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      logger.info(`Checking weth balances`);
      const poolWethDelta = currentPoolWethBalance.sub(oldPoolWethBalance);
      const wethDelta = oldWethBalance.sub(currentWethBalance);
      assert(wethDelta.eq(poolWethDelta));

      logger.info(`Checking usdc balances`);
      const poolUsdcDelta = currentPoolUsdcBalance.sub(oldPoolUsdcBalance);
      const usdcDelta = oldUsdcBalance.sub(currentUsdcBalance);
      assert(usdcDelta.eq(poolUsdcDelta));
    }
  }
}
