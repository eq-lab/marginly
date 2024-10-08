import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ERC20,
  MarginlyRouter,
  MarginlyRouter__factory,
  PendleAdapter,
  PendleAdapter__factory,
} from '../../typechain-types';
import { constructSwap, Dex, SWAP_ONE } from '../shared/utils';
import { EthAddress } from '@marginly/common';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ArbMainnetERC20BalanceOfSlot, setTokenBalance } from '../shared/tokens';

describe('Pendle swap pre maturity', () => {
  let ptToken: ERC20;
  let weth: ERC20;
  let router: MarginlyRouter;
  let pendleAdapter: PendleAdapter;
  let user: SignerWithAddress;
  let owner: SignerWithAddress;
  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    ptToken = await ethers.getContractAt('ERC20', '0x1c27Ad8a19Ba026ADaBD615F6Bc77158130cfBE4');
    weth = await ethers.getContractAt('ERC20', '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1');
    const poolInput = {
      poolData: {
        pendleMarket: '0x952083cde7aaa11AB8449057F7de23A970AA8472',
        uniswapV3LikePool: '0x14353445c8329Df76e6f15e9EAD18fA2D45A8BB6',
        ib: '0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe',
        slippage: 20,
      },
      tokenA: ptToken.address,
      tokenB: weth.address,
    };
    pendleAdapter = await new PendleAdapter__factory().connect(owner).deploy([poolInput]);
    const routerInput = {
      dexIndex: Dex.Pendle,
      adapter: pendleAdapter.address,
    };
    router = await new MarginlyRouter__factory().connect(owner).deploy([routerInput]);

    const balance = parseUnits('1', 18);
    await setTokenBalance(weth.address, ArbMainnetERC20BalanceOfSlot.WETH, EthAddress.parse(user.address), balance);
    await setTokenBalance(
      ptToken.address,
      ArbMainnetERC20BalanceOfSlot.PTWEETH,
      EthAddress.parse(user.address),
      balance
    );
  });

  it('weth to pt exact input', async () => {
    const ptBalanceBefore = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`);
    const wethBalanceBefore = await weth.balanceOf(user.address);
    console.log(`wethBalanceBefore: ${formatUnits(wethBalanceBefore, await weth.decimals())} ${await weth.symbol()}`);

    const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
    const wethSwapAmount = wethBalanceBefore;
    await weth.connect(user).approve(router.address, wethSwapAmount);
    await router
      .connect(user)
      .swapExactInput(swapCalldata, weth.address, ptToken.address, wethSwapAmount, wethSwapAmount.mul(9).div(10));

    const ptBalanceAfter = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
    expect(ptBalanceAfter).to.be.greaterThan(ptBalanceBefore);
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
    expect(wethBalanceBefore.sub(wethBalanceAfter)).to.be.eq(wethSwapAmount);
  });

  it('weth to pt exact output', async () => {
    const ptBalanceBefore = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`);
    const wethBalanceBefore = await weth.balanceOf(user.address);
    console.log(`wethBalanceBefore: ${formatUnits(wethBalanceBefore, await weth.decimals())} ${await weth.symbol()}`);

    const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
    const ptOut = wethBalanceBefore.div(2);
    await weth.connect(user).approve(router.address, wethBalanceBefore);
    await router.connect(user).swapExactOutput(swapCalldata, weth.address, ptToken.address, wethBalanceBefore, ptOut);

    const ptBalanceAfter = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
    expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(ptOut);
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
    expect(wethBalanceBefore).to.be.greaterThan(wethBalanceAfter);
  });

  it('pt to weth exact input', async () => {
    const ptBalanceBefore = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`);
    const wethBalanceBefore = await weth.balanceOf(user.address);
    console.log(`wethBalanceBefore: ${formatUnits(wethBalanceBefore, await weth.decimals())} ${await weth.symbol()}`);

    const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
    const ptIn = ptBalanceBefore;
    await ptToken.connect(user).approve(router.address, ptIn);
    await router.connect(user).swapExactInput(swapCalldata, ptToken.address, weth.address, ptIn, 0);

    const ptBalanceAfter = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
    expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
    expect(wethBalanceAfter).to.be.greaterThan(wethBalanceBefore);
  });

  it('pt to weth exact output', async () => {
    const ptBalanceBefore = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`);
    const wethBalanceBefore = await weth.balanceOf(user.address);
    console.log(`wethBalanceBefore: ${formatUnits(wethBalanceBefore, await weth.decimals())} ${await weth.symbol()}`);

    const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
    const wethOut = ptBalanceBefore.div(2);
    const maxPtIn = wethOut.mul(115).div(100);
    await ptToken.connect(user).approve(router.address, maxPtIn);
    await router
      .connect(user)
      .swapExactOutput(swapCalldata, ptToken.address, weth.address, wethOut.mul(11).div(10), wethOut);

    const ptBalanceAfter = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
    expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
    expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.eq(wethOut);
  });
});

describe('Pendle swap post maturity', () => {
  let ptToken: ERC20;
  let weth: ERC20;
  let router: MarginlyRouter;
  let pendleAdapter: PendleAdapter;
  let user: SignerWithAddress;
  let owner: SignerWithAddress;
  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    ptToken = await ethers.getContractAt('ERC20', '0x1c27Ad8a19Ba026ADaBD615F6Bc77158130cfBE4');
    weth = await ethers.getContractAt('ERC20', '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1');
    const poolInput = {
      poolData: {
        pendleMarket: '0x952083cde7aaa11AB8449057F7de23A970AA8472',
        uniswapV3LikePool: '0x14353445c8329Df76e6f15e9EAD18fA2D45A8BB6',
        ib: '0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe',
        slippage: 20,
      },
      tokenA: ptToken.address,
      tokenB: weth.address,
    };
    pendleAdapter = await new PendleAdapter__factory().connect(owner).deploy([poolInput]);
    const routerInput = {
      dexIndex: Dex.Pendle,
      adapter: pendleAdapter.address,
    };
    router = await new MarginlyRouter__factory().connect(owner).deploy([routerInput]);

    const balance = parseUnits('1', 18);
    await setTokenBalance(weth.address, ArbMainnetERC20BalanceOfSlot.WETH, EthAddress.parse(user.address), balance);
    await setTokenBalance(
      ptToken.address,
      ArbMainnetERC20BalanceOfSlot.PTWEETH,
      EthAddress.parse(user.address),
      balance
    );
    await ethers.provider.send('evm_increaseTime', [180 * 24 * 60 * 60]);
    await ethers.provider.send('evm_mine', []);
  });

  it('weth to pt exact input, forbidden', async () => {
    const ptBalanceBefore = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`);
    const wethBalanceBefore = await weth.balanceOf(user.address);
    console.log(`wethBalanceBefore: ${formatUnits(wethBalanceBefore, await weth.decimals())} ${await weth.symbol()}`);

    const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
    await weth.connect(user).approve(router.address, wethBalanceBefore);
    const tx = router
      .connect(user)
      .swapExactInput(swapCalldata, weth.address, ptToken.address, wethBalanceBefore, wethBalanceBefore.mul(9).div(10));
    await expect(tx).to.be.revertedWithCustomError(pendleAdapter, 'NotSupported');

    console.log('This swap is forbidden after maturity');
    const ptBalanceAfter = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
    expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
    expect(wethBalanceAfter).to.be.eq(wethBalanceBefore);
  });

  it('weth to pt exact output, forbidden', async () => {
    const ptBalanceBefore = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`);
    const wethBalanceBefore = await weth.balanceOf(user.address);
    console.log(`wethBalanceBefore: ${formatUnits(wethBalanceBefore, await weth.decimals())} ${await weth.symbol()}`);

    const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
    const ptOut = wethBalanceBefore.div(2);
    await weth.connect(user).approve(router.address, wethBalanceBefore);
    const tx = router
      .connect(user)
      .swapExactOutput(swapCalldata, weth.address, ptToken.address, wethBalanceBefore, ptOut);
    await expect(tx).to.be.revertedWithCustomError(pendleAdapter, 'NotSupported');

    console.log('This swap is forbidden after maturity');
    const ptBalanceAfter = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
    expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
    expect(wethBalanceAfter).to.be.eq(wethBalanceBefore);
  });

  it('pt to weth exact input', async () => {
    const ptBalanceBefore = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`);
    const wethBalanceBefore = await weth.balanceOf(user.address);
    console.log(`wethBalanceBefore: ${formatUnits(wethBalanceBefore, await weth.decimals())} ${await weth.symbol()}`);

    const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
    const ptIn = ptBalanceBefore;
    await ptToken.connect(user).approve(router.address, ptIn);
    await router.connect(user).swapExactInput(swapCalldata, ptToken.address, weth.address, ptIn, 0);

    const ptBalanceAfter = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
    expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
    expect(wethBalanceAfter).to.be.greaterThan(wethBalanceBefore);
  });

  it('pt to weth exact output', async () => {
    const ptBalanceBefore = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceBefore: ${formatUnits(ptBalanceBefore, await ptToken.decimals())} ${await ptToken.symbol()}`);
    const wethBalanceBefore = await weth.balanceOf(user.address);
    console.log(`wethBalanceBefore: ${formatUnits(wethBalanceBefore, await weth.decimals())} ${await weth.symbol()}`);

    const swapCalldata = constructSwap([Dex.Pendle], [SWAP_ONE]);
    const wethOut = ptBalanceBefore.div(2);
    await ptToken.connect(user).approve(router.address, ptBalanceBefore);
    await router
      .connect(user)
      .swapExactOutput(swapCalldata, ptToken.address, weth.address, wethOut.mul(11).div(10), wethOut);

    const ptBalanceAfter = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
    expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
    expect(wethBalanceAfter.sub(wethBalanceBefore)).to.be.eq(wethOut);
  });
});
