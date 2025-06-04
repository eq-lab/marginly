import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ERC20,
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

async function initializeRouter(): Promise<{
  ptToken: ERC20;
  sUSDEToken: ERC20;
  USDEToken: ERC20;
  router: MarginlyRouter;
  pendleCurveAdapter: PendleCurveRouterNgAdapter;
  owner: SignerWithAddress;
  user: SignerWithAddress;
}> {
  const [owner, user] = await ethers.getSigners();
  const ptToken = await ethers.getContractAt('ERC20', '0x917459337caac939d41d7493b3999f571d20d667');
  const sUSDEToken = await ethers.getContractAt('ERC20', '0x9d39a5de30e57443bff2a8307a4256c8797a3497');
  const USDEToken = await ethers.getContractAt('ERC20', '0x4c9edd5852cd905f086c759e8383e09bff1e68b3');
  const pendleMarket = '0x9df192d13d61609d1852461c4850595e1f56e714'; // PT-USDE 31 Jul 2025
  const curveRouterAddress = '0x16c6521dff6bab339122a0fe25a9116693265353';

  // Route to make swap pt-usde -> usde -> frax -> sdai -> susde
  const routeInput: PendleCurveRouterNgAdapter.RouteInputStruct = {
    pendleMarket: pendleMarket,
    slippage: 35, // 20/100  = 20%
    curveDxAdjustPtToToken: 175_800, //
    curveDxAdjustTokenToPt: -149_000, //
    curveRoute: [
      '0x4c9edd5852cd905f086c759e8383e09bff1e68b3', //usde
      '0x5dc1BF6f1e983C0b21EfB003c105133736fA0743', // usde -> frax
      '0x853d955aCEf822Db058eb8505911ED77F175b99e', //frax
      '0xcE6431D21E3fb1036CE9973a3312368ED96F5CE7', // frax -> sDAI
      '0x83F20F44975D03b1b09e64809B757c47f942BEeA', //sDAI
      '0x167478921b907422F8E88B43C4Af2B8BEa278d3A', // sDAI -> sUSDE
      '0x9d39a5de30e57443bff2a8307a4256c8797a3497', // sUSDE
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
    ], // curve route sUSDE -> sDAI -> FRAX -> USDE
    curveSwapParams: [
      [1, 0, 1, 1, 2],
      [0, 1, 1, 1, 2],
      [0, 1, 1, 1, 2],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    curvePools: [
      '0x5dc1BF6f1e983C0b21EfB003c105133736fA0743',
      '0xcE6431D21E3fb1036CE9973a3312368ED96F5CE7',
      '0x167478921b907422F8E88B43C4Af2B8BEa278d3A',
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
    parseUnits('10000', 18)
  );
  await setTokenBalance(
    ptToken.address,
    EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    EthAddress.parse(user.address),
    parseUnits('10000', 18)
  );

  console.log(routeInput);

  return {
    ptToken,
    sUSDEToken: sUSDEToken,
    USDEToken: USDEToken,
    router,
    pendleCurveAdapter,
    owner,
    user,
  };
}

// Tests for running in ethereum mainnet fork
describe('Pendle PT-USDE - sUSDE', () => {
  before(async () => {
    await resetFork(22622910);
    //await resetFork(22388154); //2025-05-02
    //await resetFork(22588100); //2025-05-29
  });

  describe('Pendle swap pre maturity', () => {
    let ptToken: ERC20;
    let sUSDEToken: ERC20;
    let USDEToken: ERC20;
    let router: MarginlyRouter;
    let pendleCurveAdapter: PendleCurveRouterNgAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;

    beforeEach(async () => {
      ({
        ptToken,
        sUSDEToken: sUSDEToken,
        USDEToken: USDEToken,
        router,
        pendleCurveAdapter,
        owner,
        user,
      } = await initializeRouter());
    });

    it('sUSDE to pt-USDE exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await sUSDEToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const sUSDESwapAmount = parseUnits('1000', 18);
      await sUSDEToken.connect(user).approve(router.address, sUSDESwapAmount);

      const minPtAmountOut = parseUnits('950', 18); //parseUnits('900', 18);

      const tx = await router
        .connect(user)
        .swapExactInput(swapCalldata, sUSDEToken.address, ptToken.address, sUSDESwapAmount, minPtAmountOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceAfter).to.be.greaterThan(ptBalanceBefore);
      const tokenBalanceAfter = await sUSDEToken.balanceOf(user.address);
      expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.be.lessThanOrEqual(sUSDESwapAmount);

      console.log(
        `${await sUSDEToken.symbol()} In: ${formatUnits(
          tokenBalanceBefore.sub(tokenBalanceAfter),
          await sUSDEToken.decimals()
        )}`
      );
      console.log(
        `${await ptToken.symbol()} Out: ${formatUnits(ptBalanceAfter.sub(ptBalanceBefore), await ptToken.decimals())}`
      );
    });

    it('sUSDE to pt-USDE exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await sUSDEToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);

      const exactPtOut = parseUnits('10000', await ptToken.decimals());
      const sUSDEMaxIn = parseUnits('10000', await sUSDEToken.decimals());
      await sUSDEToken.connect(user).approve(router.address, sUSDEMaxIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, sUSDEToken.address, ptToken.address, sUSDEMaxIn, exactPtOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(exactPtOut);
      const tokenBalanceAfter = await sUSDEToken.balanceOf(user.address);

      expect(tokenBalanceBefore).to.be.greaterThan(tokenBalanceAfter);

      const USDEOnAdapter = await USDEToken.balanceOf(pendleCurveAdapter.address);

      console.log(
        `${await sUSDEToken.symbol()} In: ${formatUnits(
          tokenBalanceBefore.sub(tokenBalanceAfter),
          await sUSDEToken.decimals()
        )}`
      );
      console.log(
        `${await ptToken.symbol()} Out: ${formatUnits(ptBalanceAfter.sub(ptBalanceBefore), await ptToken.decimals())}`
      );
      console.log(
        `${await USDEToken.symbol()} stays on adapter: ${formatUnits(
          USDEOnAdapter,
          await USDEToken.decimals()
        )} ${await USDEToken.symbol()}`
      );

      await assertSwapEvent(
        {
          isExactInput: false,
          tokenIn: sUSDEToken.address,
          tokenOut: ptToken.address,
          amountIn: tokenBalanceBefore.sub(tokenBalanceAfter),
          amountOut: ptBalanceAfter.sub(ptBalanceBefore),
        },
        router,
        tx
      );
    });

    it('sUSDE to pt-USDE exact output, small amount', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await sUSDEToken.balanceOf(user.address);
      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);

      const exactPtOut = parseUnits('10', 18);
      const wethMaxIn = parseUnits('10', 18);
      await sUSDEToken.connect(user).approve(router.address, wethMaxIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, sUSDEToken.address, ptToken.address, wethMaxIn, exactPtOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(exactPtOut);
      const tokenBalanceAfter = await sUSDEToken.balanceOf(user.address);
      expect(tokenBalanceBefore).to.be.greaterThan(tokenBalanceAfter);

      const USDEOnAdapter = await USDEToken.balanceOf(pendleCurveAdapter.address);
      console.log(
        `${await sUSDEToken.symbol()} In: ${formatUnits(
          tokenBalanceBefore.sub(tokenBalanceAfter),
          await sUSDEToken.decimals()
        )}`
      );
      console.log(
        `${await ptToken.symbol()} Out: ${formatUnits(ptBalanceAfter.sub(ptBalanceBefore), await ptToken.decimals())}`
      );
      console.log(
        `${await USDEToken.symbol()} stays on adapter: ${formatUnits(
          USDEOnAdapter,
          await USDEToken.decimals()
        )} ${await USDEToken.symbol()}`
      );

      await assertSwapEvent(
        {
          isExactInput: false,
          tokenIn: sUSDEToken.address,
          tokenOut: ptToken.address,
          amountIn: tokenBalanceBefore.sub(tokenBalanceAfter),
          amountOut: ptBalanceAfter.sub(ptBalanceBefore),
        },
        router,
        tx
      );
    });

    it('pt-USDE to sUSDE exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await sUSDEToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const ptIn = ptBalanceBefore;
      await ptToken.connect(user).approve(router.address, ptIn);
      const tx = await router.connect(user).swapExactInput(swapCalldata, ptToken.address, sUSDEToken.address, ptIn, 0);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const tokenBalanceAfter = await sUSDEToken.balanceOf(user.address);
      expect(tokenBalanceAfter).to.be.greaterThan(tokenBalanceBefore);

      console.log(
        `${await ptToken.symbol()} In: ${formatUnits(ptBalanceBefore.sub(ptBalanceAfter), await ptToken.decimals())}`
      );
      console.log(
        `${await sUSDEToken.symbol()} Out: ${formatUnits(
          tokenBalanceAfter.sub(tokenBalanceBefore),
          await sUSDEToken.decimals()
        )}`
      );

      await assertSwapEvent(
        {
          isExactInput: true,
          tokenIn: ptToken.address,
          tokenOut: sUSDEToken.address,
          amountIn: ptBalanceBefore.sub(ptBalanceAfter),
          amountOut: tokenBalanceAfter.sub(tokenBalanceBefore),
        },
        router,
        tx
      );
    });

    it('pt-USDE to sUSDE exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await sUSDEToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const wethOut = parseUnits('800', 18);
      const maxPtIn = parseUnits('1000', 18);
      await ptToken.connect(user).approve(router.address, maxPtIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, sUSDEToken.address, maxPtIn, wethOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const tokenBalanceAfter = await sUSDEToken.balanceOf(user.address);
      expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(wethOut);

      const tokenBalanceOnAdapter = await sUSDEToken.balanceOf(pendleCurveAdapter.address);
      console.log(
        `${await ptToken.symbol()} In: ${formatUnits(ptBalanceBefore.sub(ptBalanceAfter), await ptToken.decimals())}`
      );
      console.log(
        `${await sUSDEToken.symbol()} Out: ${formatUnits(
          tokenBalanceAfter.sub(tokenBalanceBefore),
          await sUSDEToken.decimals()
        )}`
      );
      console.log(
        `${await USDEToken.symbol()} stays on adapter: ${formatUnits(
          tokenBalanceOnAdapter,
          await USDEToken.decimals()
        )} ${await USDEToken.symbol()}`
      );

      await assertSwapEvent(
        {
          isExactInput: false,
          tokenIn: ptToken.address,
          tokenOut: sUSDEToken.address,
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
    let sUSDEToken: ERC20;
    let USDEToken: ERC20;
    let router: MarginlyRouter;
    let pendleCurveAdapter: PendleCurveRouterNgAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;

    beforeEach(async () => {
      ({
        ptToken,
        sUSDEToken: sUSDEToken,
        USDEToken: USDEToken,
        router,
        pendleCurveAdapter,
        owner,
        user,
      } = await initializeRouter());
      // move time and make after maturity
      await ethers.provider.send('evm_increaseTime', [180 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);
    });

    it('sUSDE to pt-teth exact input, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await sUSDEToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      await sUSDEToken.connect(user).approve(router.address, tokenBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactInput(
          swapCalldata,
          sUSDEToken.address,
          ptToken.address,
          tokenBalanceBefore,
          tokenBalanceBefore.mul(9).div(10)
        );

      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');
      console.log('This swap is forbidden after maturity');
    });

    it('sUSDE to pt-teth exact output, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await sUSDEToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const ptOut = tokenBalanceBefore.div(2);
      await sUSDEToken.connect(user).approve(router.address, tokenBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactOutput(swapCalldata, sUSDEToken.address, ptToken.address, tokenBalanceBefore, ptOut);
      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
    });

    it('pt-USDE to sUSDE exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await sUSDEToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const ptIn = ptBalanceBefore;
      await ptToken.connect(user).approve(router.address, ptIn);
      const tx = await router.connect(user).swapExactInput(swapCalldata, ptToken.address, sUSDEToken.address, ptIn, 0);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const tokenBalanceAfter = await sUSDEToken.balanceOf(user.address);
      expect(tokenBalanceAfter).to.be.greaterThan(tokenBalanceBefore);

      console.log(
        `${await ptToken.symbol()} In: ${formatUnits(ptBalanceBefore.sub(ptBalanceAfter), await ptToken.decimals())}`
      );
      console.log(
        `${await sUSDEToken.symbol()} Out: ${formatUnits(
          tokenBalanceAfter.sub(tokenBalanceBefore),
          await sUSDEToken.decimals()
        )}`
      );

      await assertSwapEvent(
        {
          isExactInput: true,
          tokenIn: ptToken.address,
          tokenOut: sUSDEToken.address,
          amountIn: ptBalanceBefore.sub(ptBalanceAfter),
          amountOut: tokenBalanceAfter.sub(tokenBalanceBefore),
        },
        router,
        tx
      );
    });

    it('pt-USDE to sUSDE exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      const tokenBalanceBefore = await sUSDEToken.balanceOf(user.address);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const tokenOut = parseUnits('900', 18);
      await ptToken.connect(user).approve(router.address, ptBalanceBefore);
      const maxPtIn = parseUnits('1200', 18);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, sUSDEToken.address, maxPtIn, tokenOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const tokenBalanceAfter = await sUSDEToken.balanceOf(user.address);
      expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(tokenOut);

      const tokenBalanceOnAdapter = await sUSDEToken.balanceOf(pendleCurveAdapter.address);
      console.log(
        `${await ptToken.symbol()} In: ${formatUnits(ptBalanceBefore.sub(ptBalanceAfter), await ptToken.decimals())}`
      );
      console.log(
        `${await sUSDEToken.symbol()} Out: ${formatUnits(
          tokenBalanceAfter.sub(tokenBalanceBefore),
          await sUSDEToken.decimals()
        )}`
      );
      console.log(
        `${await USDEToken.symbol()} stays on adapter: ${formatUnits(
          tokenBalanceOnAdapter,
          await USDEToken.decimals()
        )} ${await USDEToken.symbol()}`
      );

      await assertSwapEvent(
        {
          isExactInput: false,
          tokenIn: ptToken.address,
          tokenOut: sUSDEToken.address,
          amountIn: ptBalanceBefore.sub(ptBalanceAfter),
          amountOut: tokenBalanceAfter.sub(tokenBalanceBefore),
        },
        router,
        tx
      );
    });
  });
});
