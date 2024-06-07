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
import { EthereumMainnetERC20BalanceOfSlot, setTokenBalance } from '../shared/tokens';

async function initializeRouterEthSUSDe(): Promise<{
  ptToken: ERC20;
  sUsde: ERC20;
  router: MarginlyRouter;
  pendleAdapter: PendleMarketAdapter;
  owner: SignerWithAddress;
  user: SignerWithAddress;
}> {
  const [owner, user] = await ethers.getSigners();
  const ptToken = await ethers.getContractAt('ERC20', '0xd810362556296c834E30C9A61d8e21a5cf29eAb4');
  const sUsde = await ethers.getContractAt('ERC20', '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497');
  const poolInput = {
    pendleMarket: '0x107a2e3cd2bb9a32b9ee2e4d51143149f8367eba',
    slippage: 20,
    tokenA: ptToken.address,
    tokenB: sUsde.address,
  };
  const pendleAdapter = await new PendleMarketAdapter__factory().connect(owner).deploy([poolInput]);
  const routerInput = {
    dexIndex: Dex.Pendle,
    adapter: pendleAdapter.address,
  };
  const router = await new MarginlyRouter__factory().connect(owner).deploy([routerInput]);

  const balance = parseUnits('1000', 18);
  await setTokenBalance(
    sUsde.address,
    EthereumMainnetERC20BalanceOfSlot.SUSDE,
    EthAddress.parse(user.address),
    balance
  );
  await setTokenBalance(
    ptToken.address,
    EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    EthAddress.parse(user.address),
    balance
  );

  return {
    ptToken,
    sUsde,
    router,
    pendleAdapter,
    owner,
    user,
  };
}

// Tests for running in ethereum mainnet fork
describe('Pendle PT-sUSDE - sUSDE', () => {
  describe('Pendle swap pre maturity', () => {
    let ptToken: ERC20;
    let sUsde: ERC20;
    let router: MarginlyRouter;
    let pendleAdapter: PendleMarketAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;
    beforeEach(async () => {
      ({ ptToken, sUsde, router, pendleAdapter, owner, user } = await initializeRouterEthSUSDe());
    });

    it('sUSDe to pt exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `pt balance Before: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await sUsde.balanceOf(user.address);
      console.log(
        `sUSDe balance before: ${formatUnits(sUsdeBalanceBefore, await sUsde.decimals())} ${await sUsde.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const sUsdeSwapAmount = sUsdeBalanceBefore;
      await sUsde.connect(user).approve(router.address, sUsdeSwapAmount);
      await router
        .connect(user)
        .swapExactInput(swapCalldata, sUsde.address, ptToken.address, sUsdeSwapAmount, sUsdeSwapAmount.mul(9).div(10));

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.greaterThan(ptBalanceBefore);
      const sUsdeBalanceAfter = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await sUsde.decimals())} ${await sUsde.symbol()}`
      );
      expect(sUsdeBalanceBefore.sub(sUsdeBalanceAfter)).to.be.lessThanOrEqual(sUsdeSwapAmount);
    });

    it('sUSDE to pt exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await sUsde.decimals())} ${await sUsde.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const ptOut = sUsdeBalanceBefore.div(2);
      await sUsde.connect(user).approve(router.address, sUsdeBalanceBefore);
      await router
        .connect(user)
        .swapExactOutput(swapCalldata, sUsde.address, ptToken.address, sUsdeBalanceBefore, ptOut);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(ptOut);
      const sUsdeBalanceAfter = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await sUsde.decimals())} ${await sUsde.symbol()}`
      );
      expect(sUsdeBalanceBefore).to.be.greaterThan(sUsdeBalanceAfter);
    });

    it('pt to sUSDe exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUSDeBalanceBefore = await sUsde.balanceOf(user.address);
      console.log(
        `sUSDeBalanceBefore: ${formatUnits(sUSDeBalanceBefore, await sUsde.decimals())} ${await sUsde.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const ptIn = ptBalanceBefore;
      await ptToken.connect(user).approve(router.address, ptIn);
      await router.connect(user).swapExactInput(swapCalldata, ptToken.address, sUsde.address, ptIn, 0);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const sUsdeBalanceAfter = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await sUsde.decimals())} ${await sUsde.symbol()}`
      );
      expect(sUsdeBalanceAfter).to.be.greaterThan(sUSDeBalanceBefore);
    });

    it('pt to sUSDe exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await sUsde.decimals())} ${await sUsde.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const sUSDeOut = ptBalanceBefore.div(2);
      const maxPtIn = sUSDeOut.mul(120).div(100);
      await ptToken.connect(user).approve(router.address, maxPtIn);
      await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, sUsde.address, sUSDeOut.mul(12).div(10), sUSDeOut);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const sUsdeBalanceAfter = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await sUsde.decimals())} ${await sUsde.symbol()}`
      );
      expect(sUsdeBalanceAfter.sub(sUsdeBalanceBefore)).to.be.eq(sUSDeOut);

      const sUsdeBalanceAdapter = await sUsde.balanceOf(pendleAdapter.address);
      console.log(
        `sUsdeBalanceAdapter: ${formatUnits(sUsdeBalanceAdapter, await sUsde.decimals())} ${await sUsde.symbol()}`
      );
    });
  });

  describe('Pendle swap post maturity', () => {
    let ptToken: ERC20;
    let sUsde: ERC20;
    let router: MarginlyRouter;
    let pendleAdapter: PendleMarketAdapter;
    let user: SignerWithAddress;
    let owner: SignerWithAddress;
    beforeEach(async () => {
      ({ ptToken, sUsde, router, pendleAdapter, owner, user } = await initializeRouterEthSUSDe());

      // move time and make after maturity
      await ethers.provider.send('evm_increaseTime', [180 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);
    });

    it('sUsde to pt exact input, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await sUsde.decimals())} ${await sUsde.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      await sUsde.connect(user).approve(router.address, sUsdeBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactInput(
          swapCalldata,
          sUsde.address,
          ptToken.address,
          sUsdeBalanceBefore,
          sUsdeBalanceBefore.mul(9).div(10)
        );
      await expect(tx).to.be.revertedWithCustomError(pendleAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
      const sUsdeBalanceAfter = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await sUsde.decimals())} ${await sUsde.symbol()}`
      );
      expect(sUsdeBalanceAfter).to.be.eq(sUsdeBalanceBefore);
    });

    it('sUsde to pt exact output, forbidden', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await sUsde.decimals())} ${await sUsde.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const ptOut = sUsdeBalanceBefore.div(2);
      await sUsde.connect(user).approve(router.address, sUsdeBalanceBefore);
      const tx = router
        .connect(user)
        .swapExactOutput(swapCalldata, sUsde.address, ptToken.address, sUsdeBalanceBefore, ptOut);
      await expect(tx).to.be.revertedWithCustomError(pendleAdapter, 'NotSupported');

      console.log('This swap is forbidden after maturity');
      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
      const sUsdeBalanceAfter = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await sUsde.decimals())} ${await sUsde.symbol()}`
      );
      expect(sUsdeBalanceAfter).to.be.eq(sUsdeBalanceBefore);
    });

    it('pt to sUsde exact input', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await sUsde.decimals())} ${await sUsde.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const ptIn = ptBalanceBefore;
      await ptToken.connect(user).approve(router.address, ptIn);
      await router.connect(user).swapExactInput(swapCalldata, ptToken.address, sUsde.address, ptIn, 0);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
      const sUsdeBalanceAfter = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await sUsde.decimals())} ${await sUsde.symbol()}`
      );
      expect(sUsdeBalanceAfter).to.be.greaterThan(sUsdeBalanceBefore);
    });

    it('pt to sUsde exact output', async () => {
      const ptBalanceBefore = await ptToken.balanceOf(user.address);
      console.log(
        `ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`
      );
      const sUsdeBalanceBefore = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceBefore: ${formatUnits(sUsdeBalanceBefore, await sUsde.decimals())} ${await sUsde.symbol()}`
      );

      const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
      const sUsdeOut = ptBalanceBefore.div(2);
      await ptToken.connect(user).approve(router.address, ptBalanceBefore);
      await router
        .connect(user)
        .swapExactOutput(swapCalldata, ptToken.address, sUsde.address, sUsdeOut.mul(11).div(10), sUsdeOut);

      const ptBalanceAfter = await ptToken.balanceOf(user.address);
      console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
      expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
      const sUsdeBalanceAfter = await sUsde.balanceOf(user.address);
      console.log(
        `sUsdeBalanceAfter: ${formatUnits(sUsdeBalanceAfter, await sUsde.decimals())} ${await sUsde.symbol()}`
      );
      expect(sUsdeBalanceAfter.sub(sUsdeBalanceBefore)).to.be.eq(sUsdeOut);
    });
  });
});
