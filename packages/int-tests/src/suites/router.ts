import assert = require('assert');
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { logger } from '../utils/logger';
import { ZERO_ADDRESS } from '../utils/const';
import { constructSwap, Dex, SWAP_ONE } from '../utils/chain-ops';
import { BigNumber, ethers } from 'ethers';

export async function routerSwaps(sut: SystemUnderTest) {
  logger.info(`Starting routerSwaps test suite`);
  const { treasury, usdc, weth, swapRouter, provider } = sut;

  let currentWethBalance = await weth.balanceOf(treasury.address);
  let currentUsdcBalance = await usdc.balanceOf(treasury.address);

  const dexShouldFail = new Set<number>([Dex.DodoV1]);

  for (const dexInfo of Object.entries(Dex)) {
    const adapterAddress = await swapRouter.adapters(dexInfo[1]);
    if (adapterAddress == ZERO_ADDRESS) continue;

    // balancer adapter abi is used since it has both getPool and balancerVault methods
    const adapter = new ethers.Contract(
      adapterAddress,
      require(`@marginly/router/artifacts/contracts/adapters/BalancerAdapter.sol/BalancerAdapter.json`).abi,
      provider.provider
    );
    const dexPoolAddress =
      dexInfo[0] == 'Balancer' ? await adapter.balancerVault() : await adapter.getPool(weth.address, usdc.address);

    if (dexPoolAddress == ZERO_ADDRESS) continue;
    logger.info(`Testing ${dexInfo[0]} dex`);

    const dex = constructSwap([dexInfo[1]], [SWAP_ONE]);

    {
      logger.info(`  Testing swapExactOutput`);
      const wethAmount = parseUnits('0.01', 18);
      const usdcAmount = parseUnits('10', 6);

      const oldWethBalance = currentWethBalance;
      const oldUsdcBalance = currentUsdcBalance;

      const oldPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const oldPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      await weth.connect(treasury).approve(swapRouter.address, wethAmount);
      if (dexShouldFail.has(dexInfo[1])) {
        let failed = false;
        try {
          await (
            await swapRouter.swapExactOutput(dex, weth.address, usdc.address, wethAmount, usdcAmount, {
              gasLimit: 1_000_000,
            })
          ).wait();
        } catch {
          failed = true;
        }
        logger.info(`    Checking fail`);
        assert(failed);
      } else {
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
        assert(wethDelta.gte(poolWethDelta));
        assert(!wethDelta.eq(0));
        assert(wethDelta.lte(wethAmount));
  
        logger.info(`    Checking usdc balances`);
        const poolUsdcDelta = oldPoolUsdcBalance.sub(currentPoolUsdcBalance);
        const usdcDelta = currentUsdcBalance.sub(oldUsdcBalance);
        assert(usdcDelta.gte(poolUsdcDelta));
        assert(usdcDelta.eq(usdcAmount));
      }
    }

    {
      logger.info(`  Testing swapExactInput`);
      const wethAmount = parseUnits('0.01', 18);
      const usdcAmount = parseUnits('100', 6);

      const oldWethBalance = currentWethBalance;
      const oldUsdcBalance = currentUsdcBalance;

      const oldPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const oldPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      await usdc.connect(treasury).approve(swapRouter.address, usdcAmount);
      await (
        await swapRouter.swapExactInput(dex, usdc.address, weth.address, usdcAmount, wethAmount, {
          gasLimit: 1_000_000,
        })
      ).wait();

      currentWethBalance = await weth.balanceOf(treasury.address);
      currentUsdcBalance = await usdc.balanceOf(treasury.address);

      const currentPoolWethBalance = await weth.balanceOf(dexPoolAddress);
      const currentPoolUsdcBalance = await usdc.balanceOf(dexPoolAddress);

      logger.info(`    Checking weth balances`);
      const poolWethDelta = oldPoolWethBalance.sub(currentPoolWethBalance);
      const wethDelta = currentWethBalance.sub(oldWethBalance);

      if (dexInfo[1] != Dex.DodoV2 && dexInfo[1] != Dex.DodoV1) {
        // DODO transfer fee out from the pool, so poolWethDelta > wethDelta
        assert(wethDelta.eq(poolWethDelta));
      }
      assert(wethDelta.gte(wethAmount));

      logger.info(`    Checking usdc balances`);
      const poolUsdcDelta = currentPoolUsdcBalance.sub(oldPoolUsdcBalance);
      const usdcDelta = oldUsdcBalance.sub(currentUsdcBalance);
     
      if (dexInfo[1] == Dex.DodoV1) {
        // In case of Dodo V1 exactInput swap usdcDelta = poolUsdcDelta + uniswapV3UsdcDelta
        assert(usdcDelta.gte(poolUsdcDelta));
      } else {
        assert(usdcDelta.eq(poolUsdcDelta));
      }
      assert(usdcDelta.eq(usdcAmount));
    }
  }
}

export async function routerMultipleSwaps(sut: SystemUnderTest) {
  logger.info(`Starting routerMultipleSwaps test suite`);
  const { treasury, usdc, weth, swapRouter, provider } = sut;

  let currentWethBalance = await weth.balanceOf(treasury.address);
  let currentUsdcBalance = await usdc.balanceOf(treasury.address);

  const dexs = new Array<{ dexName: string; dexIndex: number; address: string } | undefined>();

  for (const dexInfo of Object.entries(Dex)) {
    const adapterAddress = await swapRouter.adapters(dexInfo[1]);
    if (adapterAddress == ZERO_ADDRESS || dexInfo[1] == Dex.DodoV1) continue;

    // balancer adapter abi is used since it has both getPool and balancerVault methods
    const adapter = new ethers.Contract(
      await swapRouter.adapters(dexInfo[1]),
      require(`@marginly/router/artifacts/contracts/adapters/BalancerAdapter.sol/BalancerAdapter.json`).abi,
      provider.provider
    );
    const dexPoolAddress =
      dexInfo[0] == 'Balancer' ? await adapter.balancerVault() : await adapter.getPool(weth.address, usdc.address);

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

  const swapCalldata = constructSwap(
    [dexs[firstDex]?.dexIndex!, dexs[secondDex]?.dexIndex!],
    [firstDexRatio, secondDexRatio]
  );
  logger.info(`swap calldata: ${swapCalldata}`);

  {
    logger.info(`  Testing swapExactOutput`);
    const wethAmount = parseUnits('0.01', 18);
    const usdcAmount = parseUnits('10', 6);

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
    assert(wethDelta.gte(firstPoolWethDelta.add(secondPoolWethDelta)));
    assert(!wethDelta.eq(0));
    assert(wethDelta.lte(wethAmount));

    logger.info(`    Checking usdc balances`);
    const firstPoolUsdcDelta = oldFirstPoolUsdcBalance.sub(currentFirstPoolUsdcBalance);
    const secondPoolUsdcDelta = oldSecondPoolUsdcBalance.sub(currentSecondPoolUsdcBalance);
    const usdcDelta = currentUsdcBalance.sub(oldUsdcBalance);
    if (dexs[firstDex]?.dexIndex! != Dex.DodoV2 && dexs[secondDex]?.dexIndex! != Dex.DodoV2) {
      // DODO v2 transfer fee out from the pool, so poolUsdcDelta > usdcDelta
      assert(usdcDelta.eq(firstPoolUsdcDelta.add(secondPoolUsdcDelta)));
    }
    assert(usdcDelta.eq(usdcAmount));
  }

  {
    logger.info(`  Testing swapExactInput`);
    const wethAmount = parseUnits('0.01', 18);
    const usdcAmount = parseUnits('100', 6);

    const oldWethBalance = currentWethBalance;
    const oldUsdcBalance = currentUsdcBalance;

    const oldFirstPoolWethBalance = await weth.balanceOf(dexs[firstDex]!.address);
    const oldFirstPoolUsdcBalance = await usdc.balanceOf(dexs[firstDex]!.address);

    const oldSecondPoolWethBalance = await weth.balanceOf(dexs[secondDex]!.address);
    const oldSecondPoolUsdcBalance = await usdc.balanceOf(dexs[secondDex]!.address);

    await usdc.connect(treasury).approve(swapRouter.address, usdcAmount);
    await (
      await swapRouter.swapExactInput(swapCalldata, usdc.address, weth.address, usdcAmount, wethAmount, {
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
    const firstPoolWethDelta = oldFirstPoolWethBalance.sub(currentFirstPoolWethBalance);
    const secondPoolWethDelta = oldSecondPoolWethBalance.sub(currentSecondPoolWethBalance);
    const wethDelta = currentWethBalance.sub(oldWethBalance);
    if (dexs[firstDex]?.dexIndex! != Dex.DodoV2 && dexs[secondDex]?.dexIndex! != Dex.DodoV2) {
      // DODO v2 transfer fee out from the pool, so poolWethDelta > wethDelta
      assert(wethDelta.eq(firstPoolWethDelta.add(secondPoolWethDelta)));
    }
    assert(wethDelta.gte(wethAmount));

    logger.info(`    Checking usdc balances`);
    const firstPoolUsdcDelta = currentFirstPoolUsdcBalance.sub(oldFirstPoolUsdcBalance);
    const secondPoolUsdcDelta = currentSecondPoolUsdcBalance.sub(oldSecondPoolUsdcBalance);
    const usdcDelta = oldUsdcBalance.sub(currentUsdcBalance);

    assert(usdcDelta.eq(firstPoolUsdcDelta.add(secondPoolUsdcDelta)));
    assert(usdcDelta.eq(usdcAmount));
  }
}
