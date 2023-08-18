import assert = require('assert');
import { parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { logger } from '../utils/logger';
import { ZERO_ADDRESS } from '../utils/const';
import { constructSwap, Dex, SWAP_ONE } from '../utils/chain-ops';
import { BigNumber } from 'ethers';

export async function routerSwaps(sut: SystemUnderTest) {
  logger.info(`Starting routerSwaps test suite`);
  const { treasury, usdc, weth, swapRouter } = sut;

  let currentWethBalance = await weth.balanceOf(treasury.address);
  let currentUsdcBalance = await usdc.balanceOf(treasury.address);

  const wethAmount = parseUnits('0.01', 18);
  const usdcAmount = parseUnits('10', 6);

  for (const dexInfo of Object.entries(Dex)) {
    const dexPoolAddress =
      dexInfo[0] == 'Balancer'
        ? await swapRouter.balancerVault()
        : await swapRouter.getPool(dexInfo[1], weth.address, usdc.address);
    if (dexPoolAddress == ZERO_ADDRESS) continue;
    logger.info(`Testing ${dexInfo[0]} dex`);

    const dex = constructSwap([dexInfo[1]], [SWAP_ONE]);

    {
      logger.info(`  Testing swapExactOutput`);
      const oldWethBalance = currentWethBalance;
      const oldUsdcBalance = currentUsdcBalance;

      const oldPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const oldPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      await weth.connect(treasury).approve(swapRouter.address, wethAmount);
      await (
        await swapRouter.swapExactOutput(dex, weth.address, usdc.address, wethAmount, usdcAmount, {
          gasLimit: 1_000_000,
        })
      ).wait();

      currentWethBalance = await weth.balanceOf(treasury.address);
      currentUsdcBalance = await usdc.balanceOf(treasury.address);

      const currentPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const currentPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      logger.info(`    Checking weth balances`);
      const poolWethDelta = currentPoolWethBalance.sub(oldPoolWethBalance);
      const wethDelta = oldWethBalance.sub(currentWethBalance);
      assert(wethDelta.eq(poolWethDelta));
      assert(!wethDelta.eq(0));
      assert(wethDelta.lte(wethAmount));

      logger.info(`    Checking usdc balances`);
      const poolUsdcDelta = oldPoolUsdcBalance.sub(currentPoolUsdcBalance);
      const usdcDelta = currentUsdcBalance.sub(oldUsdcBalance);
      assert(usdcDelta.eq(poolUsdcDelta));
      assert(usdcDelta.eq(usdcAmount));
    }

    {
      logger.info(`  Testing swapExactInput`);
      const oldWethBalance = currentWethBalance;
      const oldUsdcBalance = currentUsdcBalance;

      const oldPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const oldPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      await weth.connect(treasury).approve(swapRouter.address, wethAmount);
      await (
        await swapRouter.swapExactInput(dex, weth.address, usdc.address, wethAmount, usdcAmount, {
          gasLimit: 1_000_000,
        })
      ).wait();

      currentWethBalance = await weth.balanceOf(treasury.address);
      currentUsdcBalance = await usdc.balanceOf(treasury.address);

      const currentPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const currentPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      logger.info(`    Checking weth balances`);
      const poolWethDelta = currentPoolWethBalance.sub(oldPoolWethBalance);
      const wethDelta = oldWethBalance.sub(currentWethBalance);
      assert(wethDelta.eq(poolWethDelta));
      assert(wethDelta.eq(wethAmount));

      logger.info(`    Checking usdc balances`);
      const poolUsdcDelta = oldPoolUsdcBalance.sub(currentPoolUsdcBalance);
      const usdcDelta = currentUsdcBalance.sub(oldUsdcBalance);
      assert(usdcDelta.eq(poolUsdcDelta));
      assert(usdcDelta.gte(usdcAmount));
    }
  }
}

export async function routerMultipleSwaps(sut: SystemUnderTest) {
  logger.info(`Starting routerMultipleSwaps test suite`);
  const { treasury, usdc, weth, swapRouter } = sut;

  let currentWethBalance = await weth.balanceOf(treasury.address);
  let currentUsdcBalance = await usdc.balanceOf(treasury.address);

  const wethAmount = parseUnits('0.01', 18);
  const usdcAmount = parseUnits('10', 6);

  const dexs = new Array<{ dexName: string; dexIndex: number; address: string } | undefined>();

  for (const dexInfo of Object.entries(Dex)) {
    const dexPoolAddress =
      dexInfo[0] == 'Balancer'
        ? await swapRouter.balancerVault()
        : await swapRouter.getPool(dexInfo[1], weth.address, usdc.address);

    const element =
      dexPoolAddress != ZERO_ADDRESS
        ? { dexName: dexInfo[0], dexIndex: dexInfo[1], address: dexPoolAddress }
        : undefined;
    dexs.push(element);
  }

  const dexNumber = dexs.length;
  let firstDex;
  do {
    firstDex = Math.floor(Math.random() * dexNumber);
  } while (!dexs[firstDex]);
  logger.info(`First dex is ${dexs[firstDex]!.dexName}`);

  let secondDex;
  do {
    secondDex = Math.floor(Math.random() * dexNumber);
  } while (!dexs[secondDex] || secondDex === firstDex);
  logger.info(`Second dex is ${dexs[secondDex]!.dexName}`);

  const firstDexRatio = Math.floor(Math.random() * SWAP_ONE);
  logger.info(`${dexs[firstDex]!.dexName} dex ratio: ${firstDexRatio}`);
  const secondDexRatio = SWAP_ONE - firstDexRatio;
  logger.info(`${dexs[secondDex]!.dexName} dex ratio: ${secondDexRatio}`);

  const swapCalldata = constructSwap([firstDex, secondDex], [firstDexRatio, secondDexRatio]);
  logger.info(`swap calldata: ${swapCalldata}`);

  {
    logger.info(`  Testing swapExactOutput`);
    const oldWethBalance = currentWethBalance;
    const oldUsdcBalance = currentUsdcBalance;

    const oldFirstPoolWethBalance = await weth.balanceOf(dexs[firstDex]!.address);
    const oldFirstPoolUsdcBalance = await usdc.balanceOf(dexs[firstDex]!.address);

    const oldSecondPoolWethBalance = await weth.balanceOf(dexs[secondDex]!.address);
    const oldSecondPoolUsdcBalance = await usdc.balanceOf(dexs[secondDex]!.address);

    await weth.connect(treasury).approve(swapRouter.address, wethAmount);
    await (
      await swapRouter.swapExactOutput(swapCalldata, weth.address, usdc.address, wethAmount, usdcAmount, {
        gasLimit: 1_000_000,
      })
    ).wait();

    currentWethBalance = await weth.balanceOf(treasury.address);
    currentUsdcBalance = await usdc.balanceOf(treasury.address);

    const currentFirstPoolWethBalance = await weth.balanceOf(dexs[firstDex]!.address);
    const currentFirstPoolUsdcBalance = await usdc.balanceOf(dexs[firstDex]!.address);

    const currentSecondPoolWethBalance = await weth.balanceOf(dexs[secondDex]!.address);
    const currentSecondPoolUsdcBalance = await usdc.balanceOf(dexs[secondDex]!.address);

    logger.info(`    Checking weth balances`);
    const firstPoolWethDelta = currentFirstPoolWethBalance.sub(oldFirstPoolWethBalance);
    const secondPoolWethDelta = currentSecondPoolWethBalance.sub(oldSecondPoolWethBalance);
    const wethDelta = oldWethBalance.sub(currentWethBalance);
    assert(wethDelta.eq(firstPoolWethDelta.add(secondPoolWethDelta)));
    assert(!wethDelta.eq(0));
    assert(wethDelta.lte(wethAmount));

    logger.info(`    Checking usdc balances`);
    const firstPoolUsdcDelta = oldFirstPoolUsdcBalance.sub(currentFirstPoolUsdcBalance);
    const secondPoolUsdcDelta = oldSecondPoolUsdcBalance.sub(currentSecondPoolUsdcBalance);
    const usdcDelta = currentUsdcBalance.sub(oldUsdcBalance);
    assert(usdcDelta.eq(firstPoolUsdcDelta.add(secondPoolUsdcDelta)));
    assert(usdcDelta.sub(usdcAmount).abs().lte(BigNumber.from(1)));
  }

  {
    logger.info(`  Testing swapExactInput`);
    const oldWethBalance = currentWethBalance;
    const oldUsdcBalance = currentUsdcBalance;

    const oldFirstPoolWethBalance = await weth.balanceOf(dexs[firstDex]!.address);
    const oldFirstPoolUsdcBalance = await usdc.balanceOf(dexs[firstDex]!.address);

    const oldSecondPoolWethBalance = await weth.balanceOf(dexs[secondDex]!.address);
    const oldSecondPoolUsdcBalance = await usdc.balanceOf(dexs[secondDex]!.address);

    await weth.connect(treasury).approve(swapRouter.address, wethAmount);
    await (
      await swapRouter.swapExactInput(swapCalldata, weth.address, usdc.address, wethAmount, usdcAmount, {
        gasLimit: 1_000_000,
      })
    ).wait();

    currentWethBalance = await weth.balanceOf(treasury.address);
    currentUsdcBalance = await usdc.balanceOf(treasury.address);

    const currentFirstPoolWethBalance = await weth.balanceOf(dexs[firstDex]!.address);
    const currentFirstPoolUsdcBalance = await usdc.balanceOf(dexs[firstDex]!.address);

    const currentSecondPoolWethBalance = await weth.balanceOf(dexs[secondDex]!.address);
    const currentSecondPoolUsdcBalance = await usdc.balanceOf(dexs[secondDex]!.address);

    logger.info(`    Checking weth balances`);
    const firstPoolWethDelta = currentFirstPoolWethBalance.sub(oldFirstPoolWethBalance);
    const secondPoolWethDelta = currentSecondPoolWethBalance.sub(oldSecondPoolWethBalance);
    const wethDelta = oldWethBalance.sub(currentWethBalance);
    assert(wethDelta.eq(firstPoolWethDelta.add(secondPoolWethDelta)));
    assert(wethDelta.sub(wethAmount).abs().lte(BigNumber.from(1)));

    logger.info(`    Checking usdc balances`);
    const firstPoolUsdcDelta = oldFirstPoolUsdcBalance.sub(currentFirstPoolUsdcBalance);
    const secondPoolUsdcDelta = oldSecondPoolUsdcBalance.sub(currentSecondPoolUsdcBalance);
    const usdcDelta = currentUsdcBalance.sub(oldUsdcBalance);
    assert(usdcDelta.eq(firstPoolUsdcDelta.add(secondPoolUsdcDelta)));
    assert(usdcDelta.gte(usdcAmount));
  }
}
