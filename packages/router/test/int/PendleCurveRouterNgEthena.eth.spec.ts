import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ERC20,
  MarginlyRouter,
  MarginlyRouter__factory,
  PendleCurveRouterNgAdapter,
  PendleCurveRouterNgAdapter__factory,
} from '../../typechain-types';
import { constructSwap, Dex, resetFork, showGasUsage, SWAP_ONE } from '../shared/utils';
import { EthAddress } from '@marginly/common';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { EthereumMainnetERC20BalanceOfSlot, setTokenBalance } from '../shared/tokens';

async function initializeRouter(): Promise<{
  ptToken: ERC20;
  usdcToken: ERC20;
  usdeToken: ERC20;
  router: MarginlyRouter;
  pendleCurveAdapter: PendleCurveRouterNgAdapter;
  owner: SignerWithAddress;
  user: SignerWithAddress;
}> {
  const [owner, user] = await ethers.getSigners();
  const ptToken = await ethers.getContractAt('ERC20', '0x8a47b431a7d947c6a3ed6e42d501803615a97eaa');
  const usdcToken = await ethers.getContractAt('ERC20', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
  const usdeToken = await ethers.getContractAt('ERC20', '0x4c9edd5852cd905f086c759e8383e09bff1e68b3');
  const pendleMarket = '0xb451a36c8b6b2eac77ad0737ba732818143a0e25';
  const curveRouterAddress = '0x16c6521dff6bab339122a0fe25a9116693265353';

  // Route to make swap pt-USDe -> usde -> usdc
  const routeInput: PendleCurveRouterNgAdapter.RouteInputStruct = {
    pendleMarket: pendleMarket,
    slippage: 20, // 20/100  = 20%
    curveSlippage: 100, // 10/1000000 = 0.001%
    curveRoute: [
      '0x4c9edd5852cd905f086c759e8383e09bff1e68b3',
      '0x02950460e2b9529d0e00284a5fa2d7bdf3fa4d72',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
    ], // curve route usd0++ -> usd0 -> usdc
    curveSwapParams: [
      [0, 1, 1, 1, 2],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    curvePools: [
      '0x02950460e2b9529d0e00284a5fa2d7bdf3fa4d72',
      '0x0000000000000000000000000000000000000000',
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
    usdcToken.address,
    EthereumMainnetERC20BalanceOfSlot.USDC,
    EthAddress.parse(user.address),
    parseUnits('1000', 6)
  );
  await setTokenBalance(
    ptToken.address,
    EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    EthAddress.parse(user.address),
    parseUnits('1000', 18)
  );

  return {
    ptToken,
    usdcToken,
    usdeToken,
    router,
    pendleCurveAdapter,
    owner,
    user,
  };
}

// Tests for running in ethereum mainnet fork
describe('PendleCurveRouter PT-usde - usdc', () => {
  before(async () => {
    await resetFork(21493100);
  });

  describe('Pendle swap pre maturity', () => {
    let ptToken: ERC20;
    let usdc: ERC20;
    let usde: ERC20;
    let router: MarginlyRouter;
    let pendleCurveAdapter: PendleCurveRouterNgAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;

    beforeEach(async () => {
      ({
        ptToken,
        usdcToken: usdc,
        usdeToken: usde,
        router,
        pendleCurveAdapter,
        owner,
        user,
      } = await initializeRouter());
    });

    it('USDC to pt-USDe exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `pt-usde balance Before: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const usdcBalanceBefore = await usdc.balanceOf(user.address);
      console.log(
        `USDC balance before: ${formatUnits(usdcBalanceBefore, await usdc.decimals())} ${await usdc.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const usdcSwapAmount = parseUnits('100', 6);
      await usdc.connect(user).approve(router.address, usdcSwapAmount);

      const minPtAmountOut = parseUnits('90', 18); //parseUnits('900', 18);

      const tx = await router
        .connect(user)
        .swapExactInput(swapCalldata, usdc.address, ptToken.address, usdcSwapAmount, minPtAmountOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.greaterThan(ptBalanceBefore);
      const usdcBalanceAfter = await usdc.balanceOf(user.address);
      console.log(`usdcBalanceAfter: ${formatUnits(usdcBalanceAfter, await usdc.decimals())} ${await usdc.symbol()}`);
      expect(usdcBalanceBefore.sub(usdcBalanceAfter)).to.be.lessThanOrEqual(usdcSwapAmount);
    });

    it('USDC to pt-USDe exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `pt-USDe balance Before: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const usdcBalanceBefore = await usdc.balanceOf(user.address);
      console.log(
        `USDC balance before: ${formatUnits(usdcBalanceBefore, await usdc.decimals())} ${await usdc.symbol()}`
      );
      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);

      const exactPtOut = parseUnits('500', 18);
      const usdcMaxIn = parseUnits('600', 6);
      await usdc.connect(user).approve(router.address, usdcMaxIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, usdc.address, ptToken.address, usdcMaxIn, exactPtOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(exactPtOut);
      const usdcBalanceAfter = await usdc.balanceOf(user.address);
      console.log(`usdcBalanceAfter: ${formatUnits(usdcBalanceAfter, await usdc.decimals())} ${await usdc.symbol()}`);
      expect(usdcBalanceBefore).to.be.greaterThan(usdcBalanceAfter);

      const usd0PlusPlusOnAdapter = await usde.balanceOf(pendleCurveAdapter.address);
      console.log(
        `usde stays on adapter: ${formatUnits(usd0PlusPlusOnAdapter, await usde.decimals())} ${await usde.symbol()}`
      );
    });

    it('pt-USDe to USDC exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUSDeBalanceBefore = await usdc.balanceOf(user.address);
      console.log(
        `usdcBalanceBefore: ${formatUnits(sUSDeBalanceBefore, await usdc.decimals())} ${await usdc.symbol()}`
      );
      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const ptIn = ptBalanceBefore;
      await ptToken.connect(user).approve(router.address, ptIn);
      const tx = await router.connect(user).swapExactInput(swapCalldata, ptToken.address, usdc.address, ptIn, 0);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const sUsdeBalanceAfter = await usdc.balanceOf(user.address);
      console.log(`usdcBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await usdc.decimals())} ${await usdc.symbol()}`);
      expect(sUsdeBalanceAfter).to.be.greaterThan(sUSDeBalanceBefore);
    });

    it('pt-USDe to USDC exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const usdcBalanceBefore = await usdc.balanceOf(user.address);
      console.log(`usdcBalanceBefore: ${formatUnits(usdcBalanceBefore, await usdc.decimals())} ${await usdc.symbol()}`);
      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const usdcOut = parseUnits('500', 6);
      const maxPtIn = parseUnits('600', 18);
      await ptToken.connect(user).approve(router.address, maxPtIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, usdc.address, maxPtIn, usdcOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const usdcBalanceAfter = await usdc.balanceOf(user.address);
      console.log(`usdcBalanceAfter: ${formatUnits(usdcBalanceAfter, await usdc.decimals())} ${await usdc.symbol()}`);
      expect(usdcBalanceAfter.sub(usdcBalanceBefore)).to.be.eq(usdcOut);

      const usdcBalanceOnAdapter = await usdc.balanceOf(pendleCurveAdapter.address);
      console.log(
        `usdcBalanceOnAdapter: ${formatUnits(usdcBalanceOnAdapter, await usdc.decimals())} ${await usdc.symbol()}`
      );
    });
  });

  describe('Pendle swap post maturity', () => {
    let ptToken: ERC20;
    let usdc: ERC20;
    let usde: ERC20;
    let router: MarginlyRouter;
    let pendleCurveAdapter: PendleCurveRouterNgAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;

    beforeEach(async () => {
      ({
        ptToken,
        usdcToken: usdc,
        usdeToken: usde,
        router,
        pendleCurveAdapter,
        owner,
        user,
      } = await initializeRouter());

      // move time and make after maturity
      await ethers.provider.send('evm_increaseTime', [180 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);
    });

    it('USDC to pt-USDe exact input, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await usdc.balanceOf(user.address);
      console.log(
        `usdcBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await usdc.decimals())} ${await usdc.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      await usdc.connect(user).approve(router.address, sUsdeBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactInput(
          swapCalldata,
          usdc.address,
          ptToken.address,
          sUsdeBalanceBefore,
          sUsdeBalanceBefore.mul(9).div(10)
        );

      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
      const sUsdeBalanceAfter = await usdc.balanceOf(user.address);
      console.log(`usdcBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await usdc.decimals())} ${await usdc.symbol()}`);
      expect(sUsdeBalanceAfter).to.be.eq(sUsdeBalanceBefore);
    });

    it('USDC to pt-USDe exact output, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const usdcBalanceBefore = await usdc.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(usdcBalanceBefore, await usdc.decimals())} ${await usdc.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const ptOut = usdcBalanceBefore.div(2);
      await usdc.connect(user).approve(router.address, usdcBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactOutput(swapCalldata, usdc.address, ptToken.address, usdcBalanceBefore, ptOut);
      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
      const usdcBalanceAfter = await usdc.balanceOf(user.address);
      console.log(`usdcBalanceAfter: ${formatUnits(usdcBalanceAfter, await usdc.decimals())} ${await usdc.symbol()}`);
      expect(usdcBalanceAfter).to.be.eq(usdcBalanceBefore);
    });

    it('pt-USDe to USDC exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const usdcBalanceBefore = await usdc.balanceOf(user.address);
      console.log(`usdcBalanceBefore: ${formatUnits(usdcBalanceBefore, await usdc.decimals())} ${await usdc.symbol()}`);

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const ptIn = ptBalanceBefore;
      await ptToken.connect(user).approve(router.address, ptIn);
      const tx = await router.connect(user).swapExactInput(swapCalldata, ptToken.address, usdc.address, ptIn, 0);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const usdcBalanceAfter = await usdc.balanceOf(user.address);
      console.log(`usdcBalanceAfter: ${formatUnits(usdcBalanceAfter, await usdc.decimals())} ${await usdc.symbol()}`);
      expect(usdcBalanceAfter).to.be.greaterThan(usdcBalanceBefore);
    });

    it('pt-USDe to USDC exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await usdc.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await usdc.decimals())} ${await usdc.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurveRouter], [SWAP_ONE]);
      const usdcOut = parseUnits('900', 6);
      await ptToken.connect(user).approve(router.address, ptBalanceBefore);
      const maxPtIn = parseUnits('1000', 18);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, usdc.address, maxPtIn, usdcOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const usdcBalanceAfter = await usdc.balanceOf(user.address);
      console.log(`sUsdeBalanceAfter: ${formatUnits(usdcBalanceAfter, await usdc.decimals())} ${await usdc.symbol()}`);
      expect(usdcBalanceAfter.sub(sUsdeBalanceBefore)).to.be.eq(usdcOut);
    });
  });
});
