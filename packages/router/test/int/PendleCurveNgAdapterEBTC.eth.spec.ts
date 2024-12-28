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
  wbtcToken: ERC20;
  ebtcToken: ERC20;
  router: MarginlyRouter;
  pendleCurveAdapter: PendleCurveNgAdapter;
  owner: SignerWithAddress;
  user: SignerWithAddress;
}> {
  const [owner, user] = await ethers.getSigners();
  const ptToken = await ethers.getContractAt('ERC20', '0x44a7876ca99460ef3218bf08b5f52e2dbe199566');
  const wbtcToken = await ethers.getContractAt('ERC20', '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599');
  const ebtcToken = await ethers.getContractAt('ERC20', '0x657e8c867d8b37dcc18fa4caead9c45eb088c642');
  const pendleMarket = '0x2c71ead7ac9ae53d05f8664e77031d4f9eba064b';

  // Route to make swap PT-eBTC -> usde -> WBTC
  const routeInput: PendleCurveNgAdapter.RouteInputStruct = {
    pendleMarket: pendleMarket,
    slippage: 20, // 20/100  = 20%
    curveSlippage: 100, // 10/1000000 = 0.001%
    //curvePool: '0xabaf76590478f2fe0b396996f55f0b61101e9502', //TriBTCPool
    curvePool: '0x7704d01908afd31bf647d969c295bb45230cd2d6', //ebtc/WBTC pool
    ibToken: ebtcToken.address,
    quoteToken: wbtcToken.address,
  };
  const pendleCurveAdapter = await new PendleCurveNgAdapter__factory().connect(owner).deploy([routeInput]);

  const routerInput = {
    dexIndex: Dex.PendleCurve,
    adapter: pendleCurveAdapter.address,
  };
  const router = await new MarginlyRouter__factory().connect(owner).deploy([routerInput]);

  await setTokenBalance(
    wbtcToken.address,
    EthereumMainnetERC20BalanceOfSlot.WBTC,
    EthAddress.parse(user.address),
    parseUnits('10', 8)
  );
  await setTokenBalance(
    ptToken.address,
    EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    EthAddress.parse(user.address),
    parseUnits('10', 8)
  );

  return {
    ptToken,
    wbtcToken: wbtcToken,
    ebtcToken: ebtcToken,
    router,
    pendleCurveAdapter,
    owner,
    user,
  };
}

// Tests for running in ethereum mainnet fork
describe('PendleCurveAdapter PT-eBTC - WBTC', () => {
  describe('Pendle swap pre maturity', () => {
    let ptToken: ERC20;
    let WBTC: ERC20;
    let ebtc: ERC20;
    let router: MarginlyRouter;
    let pendleCurveAdapter: PendleCurveNgAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;

    beforeEach(async () => {
      ({
        ptToken,
        wbtcToken: WBTC,
        ebtcToken: ebtc,
        router,
        pendleCurveAdapter,
        owner,
        user,
      } = await initializeRouter());
    });

    it('WBTC to PT-eBTC exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `PT-eBTC balance Before: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WBTCBalanceBefore = await WBTC.balanceOf(user.address);
      console.log(
        `WBTC balance before: ${formatUnits(WBTCBalanceBefore, await WBTC.decimals())} ${await WBTC.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const WBTCSwapAmount = parseUnits('2', 8);
      await WBTC.connect(user).approve(router.address, WBTCSwapAmount);

      const minPtAmountOut = parseUnits('1.8', 8);

      const tx = await router
        .connect(user)
        .swapExactInput(swapCalldata, WBTC.address, ptToken.address, WBTCSwapAmount, minPtAmountOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.greaterThan(ptBalanceBefore);
      const WBTCBalanceAfter = await WBTC.balanceOf(user.address);
      console.log(`WBTCBalanceAfter: ${formatUnits(WBTCBalanceAfter, await WBTC.decimals())} ${await WBTC.symbol()}`);
      expect(WBTCBalanceBefore.sub(WBTCBalanceAfter)).to.be.lessThanOrEqual(WBTCSwapAmount);
    });

    it('WBTC to PT-eBTC exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `PT-eBTC balance Before: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WBTCBalanceBefore = await WBTC.balanceOf(user.address);
      console.log(
        `WBTC balance before: ${formatUnits(WBTCBalanceBefore, await WBTC.decimals())} ${await WBTC.symbol()}`
      );
      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);

      const exactPtOut = parseUnits('1', 8);
      const WBTCMaxIn = parseUnits('2.5', 8);
      await WBTC.connect(user).approve(router.address, WBTCMaxIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, WBTC.address, ptToken.address, WBTCMaxIn, exactPtOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(exactPtOut);
      const WBTCBalanceAfter = await WBTC.balanceOf(user.address);
      console.log(`WBTCBalanceAfter: ${formatUnits(WBTCBalanceAfter, await WBTC.decimals())} ${await WBTC.symbol()}`);
      expect(WBTCBalanceBefore).to.be.greaterThan(WBTCBalanceAfter);

      const ebtcOnAdapter = await ebtc.balanceOf(pendleCurveAdapter.address);
      console.log(`ebtc stays on adapter: ${formatUnits(ebtcOnAdapter, await ebtc.decimals())} ${await ebtc.symbol()}`);
    });

    it('WBTC to PT-eBTC exact output, small amount', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `PT-eBTC balance Before: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WBTCBalanceBefore = await WBTC.balanceOf(user.address);
      console.log(
        `WBTC balance before: ${formatUnits(WBTCBalanceBefore, await WBTC.decimals())} ${await WBTC.symbol()}`
      );
      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);

      const exactPtOut = parseUnits('0.0006', 8);
      const WBTCMaxIn = parseUnits('0.0012', 8);
      await WBTC.connect(user).approve(router.address, WBTCMaxIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, WBTC.address, ptToken.address, WBTCMaxIn, exactPtOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(exactPtOut);
      const WBTCBalanceAfter = await WBTC.balanceOf(user.address);
      console.log(`WBTCBalanceAfter: ${formatUnits(WBTCBalanceAfter, await WBTC.decimals())} ${await WBTC.symbol()}`);
      expect(WBTCBalanceBefore).to.be.greaterThan(WBTCBalanceAfter);

      const ebtcOnAdapter = await ebtc.balanceOf(pendleCurveAdapter.address);
      console.log(`ebtc stays on adapter: ${formatUnits(ebtcOnAdapter, await ebtc.decimals())} ${await ebtc.symbol()}`);
    });

    it('PT-eBTC to WBTC exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUSDeBalanceBefore = await WBTC.balanceOf(user.address);
      console.log(
        `WBTCBalanceBefore: ${formatUnits(sUSDeBalanceBefore, await WBTC.decimals())} ${await WBTC.symbol()}`
      );
      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const ptIn = parseUnits('0.1', 8);
      await ptToken.connect(user).approve(router.address, ptIn);
      const tx = await router.connect(user).swapExactInput(swapCalldata, ptToken.address, WBTC.address, ptIn, 0);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const sUsdeBalanceAfter = await WBTC.balanceOf(user.address);
      console.log(`WBTCBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await WBTC.decimals())} ${await WBTC.symbol()}`);
      expect(sUsdeBalanceAfter).to.be.greaterThan(sUSDeBalanceBefore);
    });

    it('PT-eBTC to WBTC exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WBTCBalanceBefore = await WBTC.balanceOf(user.address);
      console.log(`WBTCBalanceBefore: ${formatUnits(WBTCBalanceBefore, await WBTC.decimals())} ${await WBTC.symbol()}`);
      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const WBTCOut = parseUnits('1', 8);
      const maxPtIn = parseUnits('1.2', 8);
      await ptToken.connect(user).approve(router.address, maxPtIn);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, WBTC.address, maxPtIn, WBTCOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const WBTCBalanceAfter = await WBTC.balanceOf(user.address);
      console.log(`WBTCBalanceAfter: ${formatUnits(WBTCBalanceAfter, await WBTC.decimals())} ${await WBTC.symbol()}`);
      expect(WBTCBalanceAfter.sub(WBTCBalanceBefore)).to.be.eq(WBTCOut);

      const WBTCBalanceOnAdapter = await WBTC.balanceOf(pendleCurveAdapter.address);
      console.log(
        `WBTCBalanceOnAdapter: ${formatUnits(WBTCBalanceOnAdapter, await WBTC.decimals())} ${await WBTC.symbol()}`
      );
    });
  });

  describe('Pendle swap post maturity', () => {
    let ptToken: ERC20;
    let WBTC: ERC20;
    let usde: ERC20;
    let router: MarginlyRouter;
    let pendleCurveAdapter: PendleCurveNgAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;

    beforeEach(async () => {
      ({
        ptToken,
        wbtcToken: WBTC,
        ebtcToken: usde,
        router,
        pendleCurveAdapter,
        owner,
        user,
      } = await initializeRouter());

      // move time and make after maturity
      await ethers.provider.send('evm_increaseTime', [180 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);
    });

    it('WBTC to PT-eBTC exact input, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await WBTC.balanceOf(user.address);
      console.log(
        `WBTCBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await WBTC.decimals())} ${await WBTC.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      await WBTC.connect(user).approve(router.address, sUsdeBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactInput(
          swapCalldata,
          WBTC.address,
          ptToken.address,
          sUsdeBalanceBefore,
          sUsdeBalanceBefore.mul(9).div(10)
        );

      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
      const sUsdeBalanceAfter = await WBTC.balanceOf(user.address);
      console.log(`WBTCBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await WBTC.decimals())} ${await WBTC.symbol()}`);
      expect(sUsdeBalanceAfter).to.be.eq(sUsdeBalanceBefore);
    });

    it('WBTC to PT-eBTC exact output, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WBTCBalanceBefore = await WBTC.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(WBTCBalanceBefore, await WBTC.decimals())} ${await WBTC.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const ptOut = WBTCBalanceBefore.div(2);
      await WBTC.connect(user).approve(router.address, WBTCBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactOutput(swapCalldata, WBTC.address, ptToken.address, WBTCBalanceBefore, ptOut);
      await expect(tx).to.be.revertedWithCustomError(pendleCurveAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
      const WBTCBalanceAfter = await WBTC.balanceOf(user.address);
      console.log(`WBTCBalanceAfter: ${formatUnits(WBTCBalanceAfter, await WBTC.decimals())} ${await WBTC.symbol()}`);
      expect(WBTCBalanceAfter).to.be.eq(WBTCBalanceBefore);
    });

    it('PT-eBTC to WBTC exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const WBTCBalanceBefore = await WBTC.balanceOf(user.address);
      console.log(`WBTCBalanceBefore: ${formatUnits(WBTCBalanceBefore, await WBTC.decimals())} ${await WBTC.symbol()}`);

      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const ptIn = ptBalanceBefore;
      await ptToken.connect(user).approve(router.address, ptIn);
      const tx = await router.connect(user).swapExactInput(swapCalldata, ptToken.address, WBTC.address, ptIn, 0);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const WBTCBalanceAfter = await WBTC.balanceOf(user.address);
      console.log(`WBTCBalanceAfter: ${formatUnits(WBTCBalanceAfter, await WBTC.decimals())} ${await WBTC.symbol()}`);
      expect(WBTCBalanceAfter).to.be.greaterThan(WBTCBalanceBefore);
    });

    it('PT-eBTC to WBTC exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await WBTC.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await WBTC.decimals())} ${await WBTC.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.PendleCurve], [SWAP_ONE]);
      const WBTCOut = parseUnits('0.9', 8);
      await ptToken.connect(user).approve(router.address, ptBalanceBefore);
      const maxPtIn = parseUnits('1.3', 8);
      const tx = await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, WBTC.address, maxPtIn, WBTCOut);
      await showGasUsage(tx);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const WBTCBalanceAfter = await WBTC.balanceOf(user.address);
      console.log(`sUsdeBalanceAfter: ${formatUnits(WBTCBalanceAfter, await WBTC.decimals())} ${await WBTC.symbol()}`);
      expect(WBTCBalanceAfter.sub(sUsdeBalanceBefore)).to.be.eq(WBTCOut);
    });
  });
});
