import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ERC20,
  MarginlyRouter,
  MarginlyRouter__factory,
  PendleMarketAdapter,
  PendleMarketAdapter__factory,
} from '../../typechain-types';
import { constructSwap, Dex, SWAP_ONE } from '../shared/utils';
import { EthAddress } from '@marginly/common';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ArbMainnetERC20BalanceOfSlot, setTokenBalance } from '../shared/tokens';

// Arbitrum Ether.fi PT eETH / weETH

async function initializeRouterArbWeEth(): Promise<{
  ptToken: ERC20;
  weETH: ERC20;
  router: MarginlyRouter;
  pendleAdapter: PendleMarketAdapter;
  owner: SignerWithAddress;
  user: SignerWithAddress;
}> {
  const [owner, user] = await ethers.getSigners();
  const ptToken = await ethers.getContractAt('ERC20', '0xb8b0a120F6A68Dd06209619F62429fB1a8e92feC');
  const weETH = await ethers.getContractAt('ERC20', '0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe');
  const poolInput = {
    pendleMarket: '0xf9f9779d8ff604732eba9ad345e6a27ef5c2a9d6',
    slippage: 30,
    tokenA: ptToken.address,
    tokenB: weETH.address,
  };
  const pendleAdapter = await new PendleMarketAdapter__factory().connect(owner).deploy([poolInput]);
  const routerInput = {
    dexIndex: Dex.Pendle,
    adapter: pendleAdapter.address,
  };
  const router = await new MarginlyRouter__factory().connect(owner).deploy([routerInput]);

  const balance = parseUnits('1', 18);
  await setTokenBalance(weETH.address, ArbMainnetERC20BalanceOfSlot.WEETH, EthAddress.parse(user.address), balance);
  await setTokenBalance(ptToken.address, ArbMainnetERC20BalanceOfSlot.PTWEETH, EthAddress.parse(user.address), balance);

  return {
    ptToken,
    weETH,
    router,
    pendleAdapter,
    owner,
    user,
  };
}

describe('Pendle PT-weETH - weETH', () => {
  describe('Pendle swap pre maturity', () => {
    let ptToken: ERC20;
    let weETH: ERC20;
    let router: MarginlyRouter;
    let pendleAdapter: PendleMarketAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;
    beforeEach(async () => {
      ({ ptToken, weETH, router, pendleAdapter, owner, user } = await initializeRouterArbWeEth());
    });

    it('weETH to pt exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `pt balance Before: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const weETHBalanceBefore = await weETH.balanceOf(user.address);
      console.log(
        `weETH balance before: ${formatUnits(weETHBalanceBefore, await weETH.decimals())} ${await weETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const weETHSwapAmount = weETHBalanceBefore;
      await weETH.connect(user).approve(router.address, weETHSwapAmount);
      await router
        .connect(user)
        .swapExactInput(swapCalldata, weETH.address, ptToken.address, weETHSwapAmount, weETHSwapAmount.mul(9).div(10));

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.greaterThan(ptBalanceBefore);
      const weETHBalanceAfter = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceAfter: ${formatUnits(weETHBalanceAfter, await weETH.decimals())} ${await weETH.symbol()}`
      );
      expect(weETHBalanceBefore.sub(weETHBalanceAfter)).to.be.lessThanOrEqual(weETHSwapAmount);
    });

    it('weETH to pt exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const weETHBalanceBefore = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceBefore: ${formatUnits(weETHBalanceBefore, await weETH.decimals())} ${await weETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const ptOut = weETHBalanceBefore.div(2);
      await weETH.connect(user).approve(router.address, weETHBalanceBefore);
      await router
        .connect(user)
        .swapExactOutput(swapCalldata, weETH.address, ptToken.address, weETHBalanceBefore, ptOut);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(ptOut);
      const weETHBalanceAfter = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceAfter: ${formatUnits(weETHBalanceAfter, await weETH.decimals())} ${await weETH.symbol()}`
      );
      expect(weETHBalanceBefore).to.be.greaterThan(weETHBalanceAfter);
    });

    it('pt to weETH exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const weETHBalanceBefore = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceBefore: ${formatUnits(weETHBalanceBefore, await weETH.decimals())} ${await weETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const ptIn = ptBalanceBefore;
      await ptToken.connect(user).approve(router.address, ptIn);
      await router.connect(user).swapExactInput(swapCalldata, ptToken.address, weETH.address, ptIn, 0);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const weETHBalanceAfter = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceAfter: ${formatUnits(weETHBalanceAfter, await weETH.decimals())} ${await weETH.symbol()}`
      );
      expect(weETHBalanceAfter).to.be.greaterThan(weETHBalanceBefore);
    });

    it('pt to weETH exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const weETHBalanceBefore = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceBefore: ${formatUnits(weETHBalanceBefore, await weETH.decimals())} ${await weETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const weETHOut = ptBalanceBefore.div(2);
      const maxPtIn = weETHOut.mul(120).div(100);
      await ptToken.connect(user).approve(router.address, maxPtIn);
      await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, weETH.address, weETHOut.mul(12).div(10), weETHOut);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const weETHBalanceAfter = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceAfter: ${formatUnits(weETHBalanceAfter, await weETH.decimals())} ${await weETH.symbol()}`
      );
      expect(weETHBalanceAfter.sub(weETHBalanceBefore)).to.be.eq(weETHOut);

      const weETHBalanceAdapter = await weETH.balanceOf(pendleAdapter.address);
      console.log(
        `weETHBalanceAdapter: ${formatUnits(weETHBalanceAdapter, await weETH.decimals())} ${await weETH.symbol()}`
      );
    });
  });

  describe('Pendle swap post maturity', () => {
    let ptToken: ERC20;
    let weETH: ERC20;
    let router: MarginlyRouter;
    let pendleAdapter: PendleMarketAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;
    beforeEach(async () => {
      ({ ptToken, weETH, router, pendleAdapter, owner, user } = await initializeRouterArbWeEth());

      // move time and make after maturity
      await ethers.provider.send('evm_increaseTime', [180 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);
    });

    it('weETH to pt exact input, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const weETHBalanceBefore = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceBefore: ${formatUnits(weETHBalanceBefore, await weETH.decimals())} ${await weETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      await weETH.connect(user).approve(router.address, weETHBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactInput(
          swapCalldata,
          weETH.address,
          ptToken.address,
          weETHBalanceBefore,
          weETHBalanceBefore.mul(9).div(10)
        );
      await expect(tx).to.be.revertedWithCustomError(pendleAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
      const weETHBalanceAfter = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceAfter: ${formatUnits(weETHBalanceAfter, await weETH.decimals())} ${await weETH.symbol()}`
      );
      expect(weETHBalanceAfter).to.be.eq(weETHBalanceBefore);
    });

    it('weETH to pt exact output, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const weETHBalanceBefore = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceBefore: ${formatUnits(weETHBalanceBefore, await weETH.decimals())} ${await weETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const ptOut = weETHBalanceBefore.div(2);
      await weETH.connect(user).approve(router.address, weETHBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactOutput(swapCalldata, weETH.address, ptToken.address, weETHBalanceBefore, ptOut);
      await expect(tx).to.be.revertedWithCustomError(pendleAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
      const weETHBalanceAfter = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceAfter: ${formatUnits(weETHBalanceAfter, await weETH.decimals())} ${await weETH.symbol()}`
      );
      expect(weETHBalanceAfter).to.be.eq(weETHBalanceBefore);
    });

    it('pt to weETH exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const weETHBalanceBefore = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceBefore: ${formatUnits(weETHBalanceBefore, await weETH.decimals())} ${await weETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const ptIn = ptBalanceBefore;
      await ptToken.connect(user).approve(router.address, ptIn);
      await router.connect(user).swapExactInput(swapCalldata, ptToken.address, weETH.address, ptIn, 0);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const weETHBalanceAfter = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceAfter: ${formatUnits(weETHBalanceAfter, await weETH.decimals())} ${await weETH.symbol()}`
      );
      expect(weETHBalanceAfter).to.be.greaterThan(weETHBalanceBefore);
    });

    it('pt to weETH exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const weETHBalanceBefore = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceBefore: ${formatUnits(weETHBalanceBefore, await weETH.decimals())} ${await weETH.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const weETHOut = ptBalanceBefore.div(2);
      await ptToken.connect(user).approve(router.address, ptBalanceBefore);
      await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, weETH.address, weETHOut.mul(11).div(10), weETHOut);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const weETHBalanceAfter = await weETH.balanceOf(user.address);
      console.log(
        `weETHBalanceAfter: ${formatUnits(weETHBalanceAfter, await weETH.decimals())} ${await weETH.symbol()}`
      );
      expect(weETHBalanceAfter.sub(weETHBalanceBefore)).to.be.eq(weETHOut);
    });
  });
});
