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
import { formatUnits, keccak256, parseUnits } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

// TODO remove me after all the merges are resolved
function getAccountBalanceStorageSlot(account: EthAddress, tokenMappingSlot: string): string {
  return keccak256('0x' + account.toString().slice(2).padStart(64, '0') + tokenMappingSlot);
}

// TODO remove me after all the merges are resolved
export async function setTokenBalance(
  tokenAddress: string,
  balanceOfSlotAddress: string,
  account: EthAddress,
  newBalance: BigNumber
) {
  const balanceOfStorageSlot = getAccountBalanceStorageSlot(account, balanceOfSlotAddress);

  await ethers.provider.send('hardhat_setStorageAt', [
    tokenAddress,
    balanceOfStorageSlot,
    ethers.utils.hexlify(ethers.utils.zeroPad(newBalance.toHexString(), 32)),
  ]);
}

// TODO remove me after all the merges are resolved
export enum ArbMainnetERC20BalanceOfSlot {
  WETH = '0000000000000000000000000000000000000000000000000000000000000033',
  PTWEETH = '0000000000000000000000000000000000000000000000000000000000000000',
}

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
    await weth.connect(user).approve(router.address, wethBalanceBefore);
    await router
      .connect(user)
      .swapExactInput(swapCalldata, weth.address, ptToken.address, wethBalanceBefore, wethBalanceBefore.mul(9).div(10));

    const ptBalanceAfter = await ptToken.balanceOf(user.address);
    console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
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
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
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
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
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
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
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
    await expect(tx).to.be.revertedWithCustomError(pendleAdapter, 'Forbidden');

    console.log('This swap is forbidden after maturity');
    const ptBalanceAfter = await ptToken.balanceOf(user.address);
    expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
    console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
    const wethBalanceAfter = await weth.balanceOf(user.address);
    expect(wethBalanceAfter).to.be.eq(wethBalanceBefore);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
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
    await expect(tx).to.be.revertedWithCustomError(pendleAdapter, 'Forbidden');

    console.log('This swap is forbidden after maturity');
    const ptBalanceAfter = await ptToken.balanceOf(user.address);
    expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);
    console.log(`ptBalanceAfter: ${formatUnits(ptBalanceAfter, await ptToken.decimals())} ${await ptToken.symbol()}`);
    const wethBalanceAfter = await weth.balanceOf(user.address);
    expect(wethBalanceAfter).to.be.eq(wethBalanceBefore);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
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
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
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
    const wethBalanceAfter = await weth.balanceOf(user.address);
    console.log(`wethBalanceAfter: ${formatUnits(wethBalanceAfter, await weth.decimals())} ${await weth.symbol()}`);
  });
});
