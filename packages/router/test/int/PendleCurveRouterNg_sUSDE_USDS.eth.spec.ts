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
  const ptToken = await ethers.getContractAt('ERC20', '0xffec096c087c13cc268497b89a613cace4df9a48');
  const sUSDEToken = await ethers.getContractAt('ERC20', '0x9d39a5de30e57443bff2a8307a4256c8797a3497');
  const usdsToken = await ethers.getContractAt('ERC20', '0xdc035d45d973e3ec169d2276ddab16f1e407384f');
  const pendleMarket = '0xdace1121e10500e9e29d071f01593fd76b000f08'; // PT-USDS-14Aug2025
  const curveRouterAddress = '0x45312ea0eFf7E09C83CBE249fa1d7598c4C8cd4e';

  // Route to make swap PT-USDS -> USDS -> sUSDS -> sUSDe
  const routeInput: PendleCurveRouterNgAdapter.RouteInputStruct = {
    pendleMarket: pendleMarket,
    slippage: 35, // 20/100  = 20%
    curveDxAdjustTokenToPt: -103_100, //
    curveDxAdjustPtToToken: 116_000, //
    curveRoute: [
      '0xdc035d45d973e3ec169d2276ddab16f1e407384f', // USDS
      '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD', // USDS -> sUSDS
      '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD', // sUSDS
      '0x3CEf1AFC0E8324b57293a6E7cE663781bbEFBB79', // sUSDS -> sUSDe
      '0x9d39a5de30e57443bff2a8307a4256c8797a3497', // sUSDe
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
    ],
    curveSwapParams: [
      [0, 1, 9, 0, 0],
      [1, 0, 1, 1, 2],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    curvePools: [
      '0x0000000000000000000000000000000000000000',
      '0x3CEf1AFC0E8324b57293a6E7cE663781bbEFBB79',
      '0x0000000000000000000000000000000000000000',
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
    sUSDEToken.address,
    EthereumMainnetERC20BalanceOfSlot.SUSDE,
    EthAddress.parse(user.address),
    parseUnits('100000', 18)
  );
  expect(await sUSDEToken.balanceOf(user.address)).to.be.eq(parseUnits('100000', 18));
  await setTokenBalance(
    ptToken.address,
    EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    EthAddress.parse(user.address),
    parseUnits('100000', 18)
  );
  expect(await ptToken.balanceOf(user.address)).to.be.eq(parseUnits('100000', 18));

  return {
    ptToken,
    quoteToken: sUSDEToken,
    ibToken: usdsToken,
    router,
    pendleCurveAdapter,
    owner,
    user,
    routeInput: routeInput,
  };
}

// Tests for running in ethereum mainnet fork
describe('Pendle PT-USDS - sUSDe', () => {
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

    it.skip('Curve check route', async () => {
      const curveRouter = ICurveRouterNg__factory.connect('0x45312ea0eFf7E09C83CBE249fa1d7598c4C8cd4e', user);
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

      const quoteTokenIn = parseUnits('100', 18);
      const minDy = 0;

      console.log(invertedRoute);
      console.log(invertedSwapParams);
      console.log(invertedPools);

      await quoteToken.connect(user).approve(curveRouter.address, quoteTokenIn);
      await curveRouter
        .connect(user)
        .exchange(invertedRoute, invertedSwapParams as any, quoteTokenIn, minDy, invertedPools as any, user.address);

      console.log('Curve check route: ');
      console.log(`${await quoteToken.symbol()} In: ${formatUnits(quoteTokenIn, await quoteToken.decimals())}`);
      console.log(
        `${await IbToken.symbol()} Out: ${formatUnits(await IbToken.balanceOf(user.address), await IbToken.decimals())}`
      );
    });

    it('sUSDe to PT-USDS exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const quoteTokenIn = parseUnits('140', 18);
      await quoteToken.connect(user).approve(router.address, quoteTokenIn);

      const minPtOut = parseUnits('140', 18); //parseUnits('900', 18);

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

    it('sUSDe to PT-USDS exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);

      const exactPtOut = parseUnits('150', await ptToken.decimals());
      const sUSDeMaxIn = parseUnits('150', await quoteToken.decimals());
      await quoteToken.connect(user).approve(router.address, sUSDeMaxIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, quoteToken.address, ptToken.address, sUSDeMaxIn, exactPtOut);
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

    it('sUSDe to PT-USDS exact output, small amount', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);
      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);

      const exactPtOut = parseUnits('5', 18);
      const sUSDeMaxIn = parseUnits('5', 18);
      await quoteToken.connect(user).approve(router.address, sUSDeMaxIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, quoteToken.address, ptToken.address, sUSDeMaxIn, exactPtOut);
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

    it('PT-USDS to sUSDe exact input', async () => {
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

    it('PT-USDS to sUSDe exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const sUSDeOut = parseUnits('120', 18);
      const maxPtIn = parseUnits('160', 18);
      await ptToken.connect(user).approve(router.address, maxPtIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, quoteToken.address, maxPtIn, sUSDeOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const tokenBalanceAfter = await quoteToken.balanceOf(user.address);
      expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(sUSDeOut);

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

    before(async () => {
      // move time and make after maturity
      await ethers.provider.send('evm_increaseTime', [90 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);
    });

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
    });

    it('sUSDe to PT-USDS exact input, forbidden', async () => {
      const tokenIn = parseUnits('1000', 18);
      const minPtOut = parseUnits('1500', 18);
      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      await quoteToken.connect(user).approve(router.address, tokenIn);
      const tx = router
        .connect(user)
        .swapExactInput(swapCalldata, quoteToken.address, ptToken.address, tokenIn, minPtOut);

      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');
      console.log('This swap is forbidden after maturity');
    });

    it('sUSDe to PT-USDS exact output, forbidden', async () => {
      const maxTokenIn = parseUnits('1000', 18);
      const ptOut = parseUnits('1000', 18);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      await quoteToken.connect(user).approve(router.address, maxTokenIn);
      const tx = router
        .connect(user)
        .swapExactOutput(swapCalldata, quoteToken.address, ptToken.address, maxTokenIn, ptOut);
      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
    });

    it('PT-USDS to sUSDe exact input', async () => {
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

    it('PT-USDS to sUSDe exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await quoteToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const tokenOut = parseUnits('230', 18);
      const maxPtIn = parseUnits('300', 18);
      await ptToken.connect(user).approve(router.address, maxPtIn);
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
