import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ERC20,
  MarginlyRouter,
  MarginlyRouter__factory,
  PendleCurveNgAdapter,
  PendleCurveNgAdapter__factory,
} from '../../typechain-types';
import { constructSwap, Dex, showGasUsage, SWAP_ONE } from '../shared/utils';
import { EthAddress } from '@marginly/common';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { EthereumMainnetERC20BalanceOfSlot, setTokenBalance } from '../shared/tokens';

async function initializeRouter(): Promise<{
  ptToken: ERC20;
  WETHToken: ERC20;
  ebtcToken: ERC20;
  router: MarginlyRouter;
  pendleCurveAdapter: PendleCurveNgAdapter;
  owner: SignerWithAddress;
  user: SignerWithAddress;
}> {
  const [owner, user] = await ethers.getSigners();
  const ptToken = await ethers.getContractAt('ERC20', '0xef6122835a2bbf575d0117d394fda24ab7d09d4e');
  const wethToken = await ethers.getContractAt('ERC20', '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
  const weethToken = await ethers.getContractAt('ERC20', '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee');
  const pendleMarket = '0xf4cf59259d007a96c641b41621ab52c93b9691b1';

  // Route to make swap PT-eETH -> usde -> WETH
  const routeInput: PendleCurveNgAdapter.RouteInputStruct = {
    pendleMarket: pendleMarket,
    slippage: 35, // 20/100  = 20%
    curveSlippage: 10, // 10/1000000 = 0.001%
    curvePool: '0xdb74dfdd3bb46be8ce6c33dc9d82777bcfc3ded5', //weETH/WETH pool
    ibToken: weethToken.address,
    quoteToken: wethToken.address,
  };
  const pendleCurveAdapter = await new PendleCurveNgAdapter__factory().connect(owner).deploy([routeInput]);

  const routerInput = {
    dexIndex: Dex.PendleCurve,
    adapter: pendleCurveAdapter.address,
  };
  const router = await new MarginlyRouter__factory().connect(owner).deploy([routerInput]);

  await setTokenBalance(
    wethToken.address,
    EthereumMainnetERC20BalanceOfSlot.WETH,
    EthAddress.parse(user.address),
    parseUnits('10', await wethToken.decimals())
  );
  await setTokenBalance(
    ptToken.address,
    EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    EthAddress.parse(user.address),
    parseUnits('10', await ptToken.decimals())
  );

  return {
    ptToken,
    WETHToken: wethToken,
    ebtcToken: weethToken,
    router,
    pendleCurveAdapter,
    owner,
    user,
  };
}

// Tests for running in ethereum mainnet fork
describe('PendleCurveAdapter PT-eETH - WETH', () => {
  describe('Pendle swap pre maturity', () => {
    let ptToken: ERC20;
    let WETH: ERC20;
    let ebtc: ERC20;
    let router: MarginlyRouter;
    let pendleCurveAdapter: PendleCurveNgAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;

    beforeEach(async () => {
      ({
        ptToken,
        WETHToken: WETH,
        ebtcToken: ebtc,
        router,
        pendleCurveAdapter,
        owner,
        user,
      } = await initializeRouter());
    });

    it('WETH to PT-eETH exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `PT-eETH balance Before: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WETHBalanceBefore = await WETH.balanceOf(user.address);
      console.log(
        `WETH balance before: ${formatUnits(WETHBalanceBefore, await WETH.decimals())} ${await WETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const WETHSwapAmount = parseUnits('2', 18);
      await WETH.connect(user).approve(router.address, WETHSwapAmount);

      const minPtAmountOut = parseUnits('1.8', 18);

      const tx = await router
        .connect(user)
        .swapExactInput(swapCalldata, WETH.address, ptToken.address, WETHSwapAmount, minPtAmountOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.greaterThan(ptBalanceBefore);
      const WETHBalanceAfter = await WETH.balanceOf(user.address);
      console.log(`WETHBalanceAfter: ${formatUnits(WETHBalanceAfter, await WETH.decimals())} ${await WETH.symbol()}`);
      expect(WETHBalanceBefore.sub(WETHBalanceAfter)).to.be.lessThanOrEqual(WETHSwapAmount);
    });

    it('WETH to PT-eETH exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `PT-eETH balance Before: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WETHBalanceBefore = await WETH.balanceOf(user.address);
      console.log(
        `WETH balance before: ${formatUnits(WETHBalanceBefore, await WETH.decimals())} ${await WETH.symbol()}`
      );
      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);

      const exactPtOut = parseUnits('5', 18);
      const WETHMaxIn = parseUnits('6', 18);
      await WETH.connect(user).approve(router.address, WETHMaxIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, WETH.address, ptToken.address, WETHMaxIn, exactPtOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(exactPtOut);
      const WETHBalanceAfter = await WETH.balanceOf(user.address);
      console.log(`WETHBalanceAfter: ${formatUnits(WETHBalanceAfter, await WETH.decimals())} ${await WETH.symbol()}`);
      expect(WETHBalanceBefore).to.be.greaterThan(WETHBalanceAfter);

      const ebtcOnAdapter = await ebtc.balanceOf(pendleCurveAdapter.address);
      console.log(`ebtc stays on adapter: ${formatUnits(ebtcOnAdapter, await ebtc.decimals())} ${await ebtc.symbol()}`);
    });

    it('WETH to PT-eETH exact output, small amount', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `PT-eETH balance Before: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WETHBalanceBefore = await WETH.balanceOf(user.address);
      console.log(
        `WETH balance before: ${formatUnits(WETHBalanceBefore, await WETH.decimals())} ${await WETH.symbol()}`
      );
      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);

      const exactPtOut = parseUnits('0.001', 18);
      const WETHMaxIn = parseUnits('0.01', 18);
      await WETH.connect(user).approve(router.address, WETHMaxIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, WETH.address, ptToken.address, WETHMaxIn, exactPtOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(exactPtOut);
      const WETHBalanceAfter = await WETH.balanceOf(user.address);
      console.log(`WETHBalanceAfter: ${formatUnits(WETHBalanceAfter, await WETH.decimals())} ${await WETH.symbol()}`);
      expect(WETHBalanceBefore).to.be.greaterThan(WETHBalanceAfter);

      const ebtcOnAdapter = await ebtc.balanceOf(pendleCurveAdapter.address);
      console.log(`ebtc stays on adapter: ${formatUnits(ebtcOnAdapter, await ebtc.decimals())} ${await ebtc.symbol()}`);
    });

    it('PT-eETH to WETH exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUSDeBalanceBefore = await WETH.balanceOf(user.address);
      console.log(
        `WETHBalanceBefore: ${formatUnits(sUSDeBalanceBefore, await WETH.decimals())} ${await WETH.symbol()}`
      );
      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const ptIn = parseUnits('0.1', 18);
      await ptToken.connect(user).approve(router.address, ptIn);
      const tx = await router.connect(user).swapExactInput(swapCalldata, ptToken.address, WETH.address, ptIn, 0);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const sUsdeBalanceAfter = await WETH.balanceOf(user.address);
      console.log(`WETHBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await WETH.decimals())} ${await WETH.symbol()}`);
      expect(sUsdeBalanceAfter).to.be.greaterThan(sUSDeBalanceBefore);
    });

    it('PT-eETH to WETH exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WETHBalanceBefore = await WETH.balanceOf(user.address);
      console.log(`WETHBalanceBefore: ${formatUnits(WETHBalanceBefore, await WETH.decimals())} ${await WETH.symbol()}`);
      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const WETHOut = parseUnits('1', 18);
      const maxPtIn = parseUnits('1.2', 18);
      await ptToken.connect(user).approve(router.address, maxPtIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, WETH.address, maxPtIn, WETHOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const WETHBalanceAfter = await WETH.balanceOf(user.address);
      console.log(`WETHBalanceAfter: ${formatUnits(WETHBalanceAfter, await WETH.decimals())} ${await WETH.symbol()}`);
      expect(WETHBalanceAfter.sub(WETHBalanceBefore)).to.be.eq(WETHOut);

      const WETHBalanceOnAdapter = await WETH.balanceOf(pendleCurveAdapter.address);
      console.log(
        `WETHBalanceOnAdapter: ${formatUnits(WETHBalanceOnAdapter, await WETH.decimals())} ${await WETH.symbol()}`
      );
    });
  });

  describe('Pendle swap post maturity', () => {
    let ptToken: ERC20;
    let WETH: ERC20;
    let usde: ERC20;
    let router: MarginlyRouter;
    let pendleCurveAdapter: PendleCurveNgAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;

    beforeEach(async () => {
      ({
        ptToken,
        WETHToken: WETH,
        ebtcToken: usde,
        router,
        pendleCurveAdapter,
        owner,
        user,
      } = await initializeRouter());

      // move time and make after maturity
      await ethers.provider.send('evm_increaseTime', [300 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);
    });

    it('WETH to PT-eETH exact input, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await WETH.balanceOf(user.address);
      console.log(
        `WETHBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await WETH.decimals())} ${await WETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      await WETH.connect(user).approve(router.address, sUsdeBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactInput(
          swapCalldata,
          WETH.address,
          ptToken.address,
          sUsdeBalanceBefore,
          sUsdeBalanceBefore.mul(9).div(10)
        );

      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
      const sUsdeBalanceAfter = await WETH.balanceOf(user.address);
      console.log(`WETHBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await WETH.decimals())} ${await WETH.symbol()}`);
      expect(sUsdeBalanceAfter).to.be.eq(sUsdeBalanceBefore);
    });

    it('WETH to PT-eETH exact output, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WETHBalanceBefore = await WETH.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(WETHBalanceBefore, await WETH.decimals())} ${await WETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const ptOut = WETHBalanceBefore.div(2);
      await WETH.connect(user).approve(router.address, WETHBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactOutput(swapCalldata, WETH.address, ptToken.address, WETHBalanceBefore, ptOut);
      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
      const WETHBalanceAfter = await WETH.balanceOf(user.address);
      console.log(`WETHBalanceAfter: ${formatUnits(WETHBalanceAfter, await WETH.decimals())} ${await WETH.symbol()}`);
      expect(WETHBalanceAfter).to.be.eq(WETHBalanceBefore);
    });

    it('PT-eETH to WETH exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WETHBalanceBefore = await WETH.balanceOf(user.address);
      console.log(`WETHBalanceBefore: ${formatUnits(WETHBalanceBefore, await WETH.decimals())} ${await WETH.symbol()}`);

      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const ptIn = parseUnits('1', await ptToken.decimals()); //ptBalanceBefore;
      const minWETHAmountOut = parseUnits('0.7', await WETH.decimals());
      await ptToken.connect(user).approve(router.address, ptIn);
      const tx = await router
        .connect(user)
        .swapExactInput(swapCalldata, ptToken.address, WETH.address, ptIn, minWETHAmountOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const WETHBalanceAfter = await WETH.balanceOf(user.address);
      console.log(`WETHBalanceAfter: ${formatUnits(WETHBalanceAfter, await WETH.decimals())} ${await WETH.symbol()}`);
      expect(WETHBalanceAfter).to.be.greaterThan(WETHBalanceBefore);
    });

    it('PT-eETH to WETH exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await WETH.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await WETH.decimals())} ${await WETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const WETHOut = parseUnits('0.9', await WETH.decimals());
      await ptToken.connect(user).approve(router.address, ptBalanceBefore);
      const maxPtIn = parseUnits('1.3', await ptToken.decimals());
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, WETH.address, maxPtIn, WETHOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const WETHBalanceAfter = await WETH.balanceOf(user.address);
      console.log(`sUsdeBalanceAfter: ${formatUnits(WETHBalanceAfter, await WETH.decimals())} ${await WETH.symbol()}`);
      expect(WETHBalanceAfter.sub(sUsdeBalanceBefore)).to.be.eq(WETHOut);
    });
  });
});
