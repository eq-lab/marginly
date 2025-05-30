import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ERC20,
  ICurveRouterNg__factory,
  MarginlyRouter,
  MarginlyRouter__factory,
  PendleCurveRouterNgAdapter,
  PendleCurveRouterNgAdapter__factory,
} from '../../typechain-types';
import { constructSwap, Dex, resetFork, showGasUsage, SWAP_ONE, assertSwapEvent } from '../shared/utils';
import { EthAddress } from '@marginly/common';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { EthereumMainnetERC20BalanceOfSlot, setTokenBalance } from '../shared/tokens';
import { BigNumberish } from 'ethers';
import { PromiseOrValue } from '../../typechain-types/common';

const curveRouterAddress = '0x45312ea0eFf7E09C83CBE249fa1d7598c4C8cd4e';

async function initializeRouter(): Promise<{
  ptToken: ERC20;
  quoteToken: ERC20;
  ibToken: ERC20;
  router: MarginlyRouter;
  pendleCurveAdapter: PendleCurveRouterNgAdapter;
  owner: SignerWithAddress;
  user: SignerWithAddress;
  routeInput: PendleCurveRouterNgAdapter.RouteInputStruct;
}> {
  const [owner, user] = await ethers.getSigners();
  const ptToken = await ethers.getContractAt('ERC20', '0xf99985822fb361117fcf3768d34a6353e6022f5f');
  const WETH = await ethers.getContractAt('ERC20', '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
  const wstETH = await ethers.getContractAt('ERC20', '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0');
  const pendleMarket = '0xc374f7ec85f8c7de3207a10bb1978ba104bda3b2'; // PT-stETH

  // Route to make swap pt-stETH -> stETH -> ETH -> WETH
  const routeInput: PendleCurveRouterNgAdapter.RouteInputStruct = {
    pendleMarket: pendleMarket,
    slippage: 35, // 20/100  = 20%
    curveDxAdjustTokenToPt: -900, //
    curveDxAdjustPtToToken: 1000, //
    curveRoute: [
      '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0', // wstETH
      '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0', // wstETH -> stETH
      '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', // stETH
      '0xDC24316b9AE028F1497c275EB9192a3Ea0f67022', // stETH -> ETH
      '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // ETH -> WETH
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
    ],
    curveSwapParams: [
      [1, 0, 8, 0, 0],
      [1, 0, 1, 1, 2],
      [1, 0, 8, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    curvePools: [
      '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      '0x5dc1BF6f1e983C0b21EfB003c105133736fA0743',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
    ],
  };
  const pendleCurveAdapter = await new PendleCurveRouterNgAdapter__factory()
    .connect(owner)
    .deploy(curveRouterAddress, [routeInput]);

  const routerInput = {
    dexIndex: Dex.PendleCurveRouter,
    adapter: pendleCurveAdapter.address,
  };
  const router = await new MarginlyRouter__factory().connect(owner).deploy([routerInput]);

  await setTokenBalance(
    WETH.address,
    EthereumMainnetERC20BalanceOfSlot.WETH,
    EthAddress.parse(user.address),
    parseUnits('10000', 18)
  );
  expect(await WETH.balanceOf(user.address)).to.be.eq(parseUnits('10000', 18));
  await setTokenBalance(
    ptToken.address,
    EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    EthAddress.parse(user.address),
    parseUnits('10000', 18)
  );
  expect(await ptToken.balanceOf(user.address)).to.be.eq(parseUnits('10000', 18));

  return {
    ptToken,
    quoteToken: WETH,
    ibToken: wstETH,
    router,
    pendleCurveAdapter,
    owner,
    user,
    routeInput: routeInput,
  };
}

// Tests for running in ethereum mainnet fork
describe('Pendle PT-STETH - wETH', () => {
  before(async () => {
    //await resetFork(22388154); //2025-05-02
    await resetFork(22588100); //2025-05-29
  });

  describe('Pendle swap pre maturity', () => {
    let ptToken: ERC20;
    let quoteToken: ERC20;
    let IbToken: ERC20;
    let router: MarginlyRouter;
    let pendleCurveAdapter: PendleCurveRouterNgAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;
    let curveRouteInput: PendleCurveRouterNgAdapter.RouteInputStruct;

    beforeEach(async () => {
      ({
        ptToken,
        quoteToken: quoteToken,
        ibToken: IbToken,
        router,
        pendleCurveAdapter,
        owner,
        user,
        routeInput: curveRouteInput,
      } = await initializeRouter());
    });

    it.only('Curve check route', async () => {
      const curveRouter = ICurveRouterNg__factory.connect(curveRouterAddress, user);
      const invertedRoute: string[] = [];
      for (let i = 0; i < 11; i++) {
        invertedRoute.push('0x0000000000000000000000000000000000000000');
      }

      let index = 0;
      for (let i = 10; i >= 0; i--) {
        if (curveRouteInput.curveRoute[i] == '0x0000000000000000000000000000000000000000') continue;

        invertedRoute[index] = await curveRouteInput.curveRoute[i];
        index++;
      }

      const invertedSwapParams: BigNumberish[][] = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ];

      const invertedPools: string[] = [];
      for (let i = 0; i < 5; i++) {
        invertedPools.push('0x0000000000000000000000000000000000000000');
      }

      index = 0;
      for (let j = 4; j >= 0; --j) {
        if (curveRouteInput.curveSwapParams[j][0] == 0 && curveRouteInput.curveSwapParams[j][1] == 0) {
          continue; // empty element
        }

        invertedSwapParams[index][0] = await curveRouteInput.curveSwapParams[j][1];
        invertedSwapParams[index][1] = await curveRouteInput.curveSwapParams[j][0];
        invertedSwapParams[index][2] = await curveRouteInput.curveSwapParams[j][2];
        invertedSwapParams[index][3] = await curveRouteInput.curveSwapParams[j][3];
        invertedSwapParams[index][4] = await curveRouteInput.curveSwapParams[j][4];

        invertedPools[index] = await curveRouteInput.curvePools[j];

        ++index;
        if (j == 0) break;
      }

      const quoteTokenIn = parseUnits('1', 18);
      const minDy = 0;

      await quoteToken.connect(user).approve(curveRouter.address, quoteTokenIn);
      const tx = await curveRouter
        .connect(user)
        .exchange(invertedRoute, invertedSwapParams as any, quoteTokenIn, minDy, invertedPools as any, user.address);
      await showGasUsage(tx);

      console.log('Curve check route: ');
      console.log(`${await quoteToken.symbol()} In: ${formatUnits(quoteTokenIn, await quoteToken.decimals())}`);
      console.log(
        `${await IbToken.symbol()} Out: ${formatUnits(await IbToken.balanceOf(user.address), await IbToken.decimals())}`
      );
    });

    it('wETH to pt-STETH exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const quoteTokenIn = parseUnits('0.1', 18);
      await quoteToken.connect(user).approve(router.address, quoteTokenIn);

      const minPtOut = parseUnits('0.1', 18); //parseUnits('900', 18);

      const tx = await router
        .connect(user)
        .swapExactInput(swapCalldata, quoteToken.address, ptToken.address, quoteTokenIn, minPtOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceAfter).to.be.greaterThan(ptBalanceBefore);
      const tokenBalanceAfter = await quoteToken.balanceOf(user.address);
      expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.be.lessThanOrEqual(quoteTokenIn);

      console.log(
        `${await quoteToken.symbol()} In: ${formatUnits(
          tokenBalanceBefore.sub(tokenBalanceAfter),
          await quoteToken.decimals()
        )}`
      );
      console.log(
        `${await ptToken.symbol()} Out: ${formatUnits(ptBalanceAfter.sub(ptBalanceBefore), await ptToken.decimals())}`
      );
    });

    it('wETH to pt-STETH exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);

      const exactPtOut = parseUnits('10', await ptToken.decimals());
      const wETHMaxIn = parseUnits('10.5', await quoteToken.decimals());
      await quoteToken.connect(user).approve(router.address, wETHMaxIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, quoteToken.address, ptToken.address, wETHMaxIn, exactPtOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(exactPtOut);
      const tokenBalanceAfter = await quoteToken.balanceOf(user.address);

      expect(tokenBalanceBefore).to.be.greaterThan(tokenBalanceAfter);

      const IbTokenOnAdapter = await IbToken.balanceOf(pendleCurveAdapter.address);

      console.log(
        `${await quoteToken.symbol()} In: ${formatUnits(
          tokenBalanceBefore.sub(tokenBalanceAfter),
          await quoteToken.decimals()
        )}`
      );
      console.log(
        `${await ptToken.symbol()} Out: ${formatUnits(ptBalanceAfter.sub(ptBalanceBefore), await ptToken.decimals())}`
      );
      console.log(
        `${await IbToken.symbol()} stays on adapter: ${formatUnits(
          IbTokenOnAdapter,
          await IbToken.decimals()
        )} ${await IbToken.symbol()}`
      );

      await assertSwapEvent(
        {
          isExactInput: false,
          tokenIn: quoteToken.address,
          tokenOut: ptToken.address,
          amountIn: tokenBalanceBefore.sub(tokenBalanceAfter),
          amountOut: ptBalanceAfter.sub(ptBalanceBefore),
        },
        router,
        tx
      );
    });

    it('wETH to pt-STETH exact output, small amount', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);
      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);

      const exactPtOut = parseUnits('0.05', 18);
      const wethMaxIn = parseUnits('0.05', 18);
      await quoteToken.connect(user).approve(router.address, wethMaxIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, quoteToken.address, ptToken.address, wethMaxIn, exactPtOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(exactPtOut);
      const tokenBalanceAfter = await quoteToken.balanceOf(user.address);
      expect(tokenBalanceBefore).to.be.greaterThan(tokenBalanceAfter);

      const IbTokenOnAdapter = await IbToken.balanceOf(pendleCurveAdapter.address);
      console.log(
        `${await quoteToken.symbol()} In: ${formatUnits(
          tokenBalanceBefore.sub(tokenBalanceAfter),
          await quoteToken.decimals()
        )}`
      );
      console.log(
        `${await ptToken.symbol()} Out: ${formatUnits(ptBalanceAfter.sub(ptBalanceBefore), await ptToken.decimals())}`
      );
      console.log(
        `${await IbToken.symbol()} stays on adapter: ${formatUnits(
          IbTokenOnAdapter,
          await IbToken.decimals()
        )} ${await IbToken.symbol()}`
      );

      await assertSwapEvent(
        {
          isExactInput: false,
          tokenIn: quoteToken.address,
          tokenOut: ptToken.address,
          amountIn: tokenBalanceBefore.sub(tokenBalanceAfter),
          amountOut: ptBalanceAfter.sub(ptBalanceBefore),
        },
        router,
        tx
      );
    });

    it('pt-STETH to wETH exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const ptIn = parseUnits('2', 18);
      await ptToken.connect(user).approve(router.address, ptIn);
      const tx = await router.connect(user).swapExactInput(swapCalldata, ptToken.address, quoteToken.address, ptIn, 0);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const tokenBalanceAfter = await quoteToken.balanceOf(user.address);
      expect(tokenBalanceAfter).to.be.greaterThan(tokenBalanceBefore);

      console.log(
        `${await ptToken.symbol()} In: ${formatUnits(ptBalanceBefore.sub(ptBalanceAfter), await ptToken.decimals())}`
      );
      console.log(
        `${await quoteToken.symbol()} Out: ${formatUnits(
          tokenBalanceAfter.sub(tokenBalanceBefore),
          await quoteToken.decimals()
        )}`
      );

      await assertSwapEvent(
        {
          isExactInput: true,
          tokenIn: ptToken.address,
          tokenOut: quoteToken.address,
          amountIn: ptBalanceBefore.sub(ptBalanceAfter),
          amountOut: tokenBalanceAfter.sub(tokenBalanceBefore),
        },
        router,
        tx
      );
    });

    it('pt-STETH to wETH exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const wethOut = parseUnits('15', 18);
      const maxPtIn = parseUnits('16', 18);
      await ptToken.connect(user).approve(router.address, maxPtIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, quoteToken.address, maxPtIn, wethOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const tokenBalanceAfter = await quoteToken.balanceOf(user.address);
      expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(wethOut);

      const tokenBalanceOnAdapter = await quoteToken.balanceOf(pendleCurveAdapter.address);
      console.log(
        `${await ptToken.symbol()} In: ${formatUnits(ptBalanceBefore.sub(ptBalanceAfter), await ptToken.decimals())}`
      );
      console.log(
        `${await quoteToken.symbol()} Out: ${formatUnits(
          tokenBalanceAfter.sub(tokenBalanceBefore),
          await quoteToken.decimals()
        )}`
      );
      console.log(
        `${await IbToken.symbol()} stays on adapter: ${formatUnits(
          tokenBalanceOnAdapter,
          await IbToken.decimals()
        )} ${await IbToken.symbol()}`
      );

      await assertSwapEvent(
        {
          isExactInput: false,
          tokenIn: ptToken.address,
          tokenOut: quoteToken.address,
          amountIn: ptBalanceBefore.sub(ptBalanceAfter),
          amountOut: tokenBalanceAfter.sub(tokenBalanceBefore),
        },
        router,
        tx
      );
    });
  });

  describe('Pendle swap post maturity', () => {
    let ptToken: ERC20;
    let quoteToken: ERC20;
    let IbToken: ERC20;
    let router: MarginlyRouter;
    let pendleCurveAdapter: PendleCurveRouterNgAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;

    beforeEach(async () => {
      ({
        ptToken,
        quoteToken: quoteToken,
        ibToken: IbToken,
        router,
        pendleCurveAdapter,
        owner,
        user,
      } = await initializeRouter());
      // move time and make after maturity
      await ethers.provider.send('evm_increaseTime', [225 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);
    });

    it('wETH to pt-teth exact input, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      await quoteToken.connect(user).approve(router.address, tokenBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactInput(
          swapCalldata,
          quoteToken.address,
          ptToken.address,
          tokenBalanceBefore,
          tokenBalanceBefore.mul(9).div(10)
        );

      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');
      console.log('This swap is forbidden after maturity');
    });

    it('wETH to pt-teth exact output, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const ptOut = tokenBalanceBefore.div(2);
      await quoteToken.connect(user).approve(router.address, tokenBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactOutput(swapCalldata, quoteToken.address, ptToken.address, tokenBalanceBefore, ptOut);
      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
    });

    it('pt-STETH to WETH exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const ptIn = parseUnits('10', 18);
      await ptToken.connect(user).approve(router.address, ptIn);
      const tx = await router.connect(user).swapExactInput(swapCalldata, ptToken.address, quoteToken.address, ptIn, 0);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const tokenBalanceAfter = await quoteToken.balanceOf(user.address);
      expect(tokenBalanceAfter).to.be.greaterThan(tokenBalanceBefore);

      console.log(
        `${await ptToken.symbol()} In: ${formatUnits(ptBalanceBefore.sub(ptBalanceAfter), await ptToken.decimals())}`
      );
      console.log(
        `${await quoteToken.symbol()} Out: ${formatUnits(
          tokenBalanceAfter.sub(tokenBalanceBefore),
          await quoteToken.decimals()
        )}`
      );

      await assertSwapEvent(
        {
          isExactInput: true,
          tokenIn: ptToken.address,
          tokenOut: quoteToken.address,
          amountIn: ptBalanceBefore.sub(ptBalanceAfter),
          amountOut: tokenBalanceAfter.sub(tokenBalanceBefore),
        },
        router,
        tx
      );
    });

    it('pt-STETH to WETH exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const tokenOut = parseUnits('250', 18);
      await ptToken.connect(user).approve(router.address, ptBalanceBefore);
      const maxPtIn = parseUnits('255', 18);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, quoteToken.address, maxPtIn, tokenOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const tokenBalanceAfter = await quoteToken.balanceOf(user.address);
      expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(tokenOut);

      const tokenBalanceOnAdapter = await quoteToken.balanceOf(pendleCurveAdapter.address);
      console.log(
        `${await ptToken.symbol()} In: ${formatUnits(ptBalanceBefore.sub(ptBalanceAfter), await ptToken.decimals())}`
      );
      console.log(
        `${await quoteToken.symbol()} Out: ${formatUnits(
          tokenBalanceAfter.sub(tokenBalanceBefore),
          await quoteToken.decimals()
        )}`
      );
      console.log(
        `${await IbToken.symbol()} stays on adapter: ${formatUnits(
          tokenBalanceOnAdapter,
          await IbToken.decimals()
        )} ${await IbToken.symbol()}`
      );

      await assertSwapEvent(
        {
          isExactInput: false,
          tokenIn: ptToken.address,
          tokenOut: quoteToken.address,
          amountIn: ptBalanceBefore.sub(ptBalanceAfter),
          amountOut: tokenBalanceAfter.sub(tokenBalanceBefore),
        },
        router,
        tx
      );
    });
  });
});
