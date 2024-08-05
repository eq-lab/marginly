import { ethers } from 'hardhat';
import { ERC20, ERC20__factory, ICurvePool, MarginlyRouter, SpectraSWIbtPtCurveAdapter } from '../../typechain-types';
import { AdapterInputStruct } from '@marginly/periphery/typechain-types/contracts/admin/abstract/RouterActions';
import { BigNumber, Contract } from 'ethers';
import { EthAddress } from '@marginly/common';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ArbMainnetERC20BalanceOfSlot, EthereumMainnetERC20BalanceOfSlot, setTokenBalance } from '../shared/tokens';
import { parseEther, parseUnits } from 'ethers/lib/utils';

interface TokenInfo {
  contract: ERC20;
  symbol: string;
  decimals: number;
  balanceOfSlot: string;
}

function formatTokenBalance(token: TokenInfo, amount: BigNumber): string {
  return `${ethers.utils.formatUnits(amount, token.decimals)} ${token.symbol}`;
}

describe.only('Curve adapter for sw-uniBTC/Pt-uniBTC pool (CurveAdapter)', () => {
  // sw-uniBTC/Pt-uniBTC pool - https://etherscan.io/address/0xb09fc8bbdcc8dc9d8b3775132c52fcebf1c7dbb3
  const poolAddress = '0xb09fc8bbdcc8dc9d8b3775132c52fcebf1c7dbb3';
  const uniBtcAddress = '0x004E9C3EF86bc1ca1f0bB5C7662861Ee93350568';

  const uniBtcHolderAddress = '0x447D5867d07be4E8e87fD08CBA5C8426F7835632';
  let uniBtcHolder: SignerWithAddress;
  const ptUniBtcHolderAddress = '0x14975679e5f87c25fa2c54958e735a79B5B93043';
  let ptUniBtcHolder: SignerWithAddress;

  let swUniBtc: TokenInfo;
  let ptUniBtc: TokenInfo;
  let uniBtc: TokenInfo;
  let pool: ICurvePool;
  let router: MarginlyRouter;
  let adapter: SpectraSWIbtPtCurveAdapter;

  before(async () => {
    pool = await ethers.getContractAt('ICurvePool', poolAddress);
    const adapterFactory = await ethers.getContractFactory('SpectraSWIbtPtCurveAdapter');

    const token0Address = await pool.callStatic.coins(0);
    const token1Address = await pool.callStatic.coins(1);
    const token0Contract = await ethers.getContractAt('ERC20', token0Address);
    const token1Contract = await ethers.getContractAt('ERC20', token1Address);
    const uniBtcContract = await ethers.getContractAt('ERC20', uniBtcAddress);
    const token0Symbol = await token0Contract.symbol();
    const token1Symbol = await token1Contract.symbol();
    const token0Decimals = await token0Contract.decimals();
    const token1Decimals = await token1Contract.decimals();

    swUniBtc = <TokenInfo>{
      contract: token0Contract,
      symbol: token0Symbol,
      decimals: token0Decimals,
      balanceOfSlot: EthereumMainnetERC20BalanceOfSlot.UNIBTC,
    };
    ptUniBtc = <TokenInfo>{
      contract: token1Contract,
      symbol: token1Symbol,
      decimals: token1Decimals,
      balanceOfSlot: EthereumMainnetERC20BalanceOfSlot.UNIBTC,
    };
    uniBtc = <TokenInfo>{
      contract: uniBtcContract,
      symbol: await uniBtcContract.symbol(),
      decimals: await uniBtcContract.decimals(),
      balanceOfSlot: EthereumMainnetERC20BalanceOfSlot.UNIBTC,
    };

    adapter = await adapterFactory.deploy([
      <SpectraSWIbtPtCurveAdapter.PoolInputStruct>{
        ibToken: uniBtcAddress,
        ptToken: token1Address,
        pool: poolAddress,
      },
    ]);
    console.log('Adapter address: ', adapter.address);

    const routerFactory = await ethers.getContractFactory('MarginlyRouter');
    router = await routerFactory.deploy([<AdapterInputStruct>{ dexIndex: 0, adapter: adapter.address }]);

    const [owner, user1, user2] = await ethers.getSigners();
    uniBtcHolder = await ethers.getImpersonatedSigner(uniBtcHolderAddress);
    ptUniBtcHolder = await ethers.getImpersonatedSigner(ptUniBtcHolderAddress);

    await owner.sendTransaction({
      to: uniBtcHolderAddress,
      value: parseEther('1.0'),
    });

    await owner.sendTransaction({
      to: ptUniBtcHolderAddress,
      value: parseEther('1.0'),
    });

    const token0InitBalance = BigNumber.from(10).pow(8);
    await uniBtc.contract.connect(uniBtcHolder).transfer(owner.address, token0InitBalance);
    await uniBtc.contract.connect(uniBtcHolder).transfer(user1.address, token0InitBalance);
    await uniBtc.contract.connect(uniBtcHolder).transfer(user2.address, token0InitBalance);

    const token1InitBalance = BigNumber.from(10).pow(8);
    await ptUniBtc.contract.connect(ptUniBtcHolder).transfer(owner.address, token1InitBalance);
    await ptUniBtc.contract.connect(ptUniBtcHolder).transfer(user1.address, token1InitBalance);
    await ptUniBtc.contract.connect(ptUniBtcHolder).transfer(user2.address, token1InitBalance);
  });

  function printPrice(priceInToken0: BigNumber) {
    const priceStr = ethers.utils.formatEther(priceInToken0);
    const inversePrice = 1 / Number.parseFloat(priceStr);
    console.log(`1 ${ptUniBtc.symbol} = ${priceStr} ${uniBtc.symbol}`);
    console.log(`1 ${uniBtc.symbol} = ${inversePrice} ${ptUniBtc.symbol}`);
  }

  function printPriceWithDelta(newPriceInToken0: BigNumber, oldPriceInToken0: BigNumber) {
    const newPriceStr = ethers.utils.formatEther(newPriceInToken0);
    const inverseNewPrice = 1 / Number.parseFloat(newPriceStr);

    const oldPriceStr = ethers.utils.formatEther(oldPriceInToken0);
    const inverseOldPrice = 1 / Number.parseFloat(oldPriceStr);

    const deltaPrice = newPriceInToken0.sub(oldPriceInToken0);
    const deltaPriceStr = ethers.utils.formatEther(deltaPrice);
    const deltaInversePrice = inverseNewPrice - inverseOldPrice;

    console.log(`1 ${ptUniBtc.symbol} = ${newPriceStr} ${uniBtc.symbol}, delta: ${deltaPriceStr} ${uniBtc.symbol}`);
    console.log(
      `1 ${uniBtc.symbol} = ${inverseNewPrice} ${ptUniBtc.symbol}, ` + `delta: ${deltaInversePrice} ${ptUniBtc.symbol}`
    );
  }

  async function printAdapterBalances() {
    console.log(
      `\nAdapter uniBTC balance after swap:${formatTokenBalance(
        uniBtc,
        await uniBtc.contract.balanceOf(adapter.address)
      )}`
    );

    console.log(
      `Adapter ptUniBTC balance after swap:${formatTokenBalance(
        ptUniBtc,
        await ptUniBtc.contract.balanceOf(adapter.address)
      )}`
    );
  }

  async function postMaturity() {
    // move time and make after maturity
    await ethers.provider.send('evm_increaseTime', [180 * 24 * 60 * 60]);
    await ethers.provider.send('evm_mine', []);
  }

  async function swapExactInput(
    signer: SignerWithAddress,
    zeroToOne: boolean,
    amountIn: BigNumber,
    minAmountOut: BigNumber
  ) {
    const inToken = zeroToOne ? uniBtc : ptUniBtc;
    const outToken = zeroToOne ? ptUniBtc : uniBtc;
    const inTokenBalanceBefore = await inToken.contract.balanceOf(signer.address);
    const outTokenBalanceBefore = await outToken.contract.balanceOf(signer.address);
    console.log(
      `signer balance before swap: ${formatTokenBalance(inToken, inTokenBalanceBefore)}, ` +
        `${formatTokenBalance(outToken, outTokenBalanceBefore)}`
    );
    const amountInStr = formatTokenBalance(inToken, amountIn);
    const minAmountOutStr = formatTokenBalance(outToken, minAmountOut);
    console.log(`swapExactInput:`);
    console.log(`amountIn: ${amountInStr}`);
    console.log(`minAmountOut: ${minAmountOutStr}`);
    const priceInToken0Before = await pool.last_prices();
    await router.swapExactInput(
      BigNumber.from(0),
      inToken.contract.address,
      outToken.contract.address,
      amountIn,
      minAmountOut
    );
    const inTokenBalanceAfter = await inToken.contract.balanceOf(signer.address);
    const outTokenBalanceAfter = await outToken.contract.balanceOf(signer.address);
    console.log(
      `\nsigner balance after swap: ${formatTokenBalance(inToken, inTokenBalanceAfter)}, ` +
        `${formatTokenBalance(outToken, outTokenBalanceAfter)}`
    );
    const inTokenDelta = inTokenBalanceBefore.sub(inTokenBalanceAfter);
    const outTokenDelta = outTokenBalanceAfter.sub(outTokenBalanceBefore);
    console.log(
      `signer balances delta: -${formatTokenBalance(inToken, inTokenDelta)}, ` +
        `${formatTokenBalance(outToken, outTokenDelta)}`
    );
    const one = BigNumber.from(10).pow(18);
    let actualPriceInToken0: BigNumber;
    if (zeroToOne) {
      actualPriceInToken0 = inTokenDelta.mul(one).div(outTokenDelta);
    } else {
      actualPriceInToken0 = outTokenDelta.mul(one).div(inTokenDelta);
    }
    console.log(`\nPrice before swap (fees not included):`);
    printPrice(priceInToken0Before);
    console.log(`\nActual swap price (with fees):`);
    printPriceWithDelta(actualPriceInToken0, priceInToken0Before);
    expect(inTokenBalanceAfter).to.be.equal(inTokenBalanceBefore.sub(amountIn));
    expect(outTokenBalanceAfter).to.be.greaterThanOrEqual(outTokenBalanceBefore.add(minAmountOut));

    await printAdapterBalances();
  }

  async function swapExactOutput(
    signer: SignerWithAddress,
    zeroToOne: boolean,
    maxAmountIn: BigNumber,
    amountOut: BigNumber
  ) {
    const inToken = zeroToOne ? uniBtc : ptUniBtc;
    const outToken = zeroToOne ? ptUniBtc : uniBtc;
    const inTokenBalanceBefore = await inToken.contract.balanceOf(signer.address);
    const outTokenBalanceBefore = await outToken.contract.balanceOf(signer.address);

    console.log(
      `signer balance before swap: ${formatTokenBalance(inToken, inTokenBalanceBefore)}, ` +
        `${formatTokenBalance(outToken, outTokenBalanceBefore)}`
    );
    const maxAmountInStr = formatTokenBalance(inToken, maxAmountIn);
    const amountOutStr = formatTokenBalance(outToken, amountOut);

    console.log(`swapExactOutput:`);
    console.log(`maxAmountIn: ${maxAmountInStr}`);
    console.log(`amountOut: ${amountOutStr}`);

    const priceInToken0Before = await pool.last_prices();

    await router.swapExactOutput(
      BigNumber.from(0),
      inToken.contract.address,
      outToken.contract.address,
      maxAmountIn,
      amountOut
    );

    const inTokenBalanceAfter = await inToken.contract.balanceOf(signer.address);
    const outTokenBalanceAfter = await outToken.contract.balanceOf(signer.address);

    console.log(
      `\nsigner balance after swap: ${formatTokenBalance(inToken, inTokenBalanceAfter)}, ` +
        `${formatTokenBalance(outToken, outTokenBalanceAfter)}`
    );

    const inTokenDelta = inTokenBalanceBefore.sub(inTokenBalanceAfter);
    const outTokenDelta = outTokenBalanceAfter.sub(outTokenBalanceBefore);
    console.log(
      `signer balances delta: -${formatTokenBalance(inToken, inTokenDelta)}, ` +
        `${formatTokenBalance(outToken, outTokenDelta)}`
    );
    const one = BigNumber.from(10).pow(18);
    let actualPriceInToken0: BigNumber;
    if (zeroToOne) {
      actualPriceInToken0 = inTokenDelta.mul(one).div(outTokenDelta);
    } else {
      actualPriceInToken0 = outTokenDelta.mul(one).div(inTokenDelta);
    }

    console.log(`\nPrice before swap (fees not included):`);
    printPrice(priceInToken0Before);
    console.log(`\nActual swap price (with fees):`);
    printPriceWithDelta(actualPriceInToken0, priceInToken0Before);

    expect(inTokenBalanceAfter).to.be.greaterThanOrEqual(inTokenBalanceBefore.sub(maxAmountIn));
    expect(outTokenBalanceAfter).to.be.equal(outTokenBalanceBefore.add(amountOut));

    await printAdapterBalances();
  }

  it('swapExactInput pre maturity uniBtc to pt-uniBTC', async () => {
    const [owner] = await ethers.getSigners();
    const amountIn = parseUnits('0.01', 8);
    const minAmountOut = amountIn.div(100);

    await uniBtc.contract.connect(owner).approve(router.address, amountIn);

    await swapExactInput(owner, true, amountIn, minAmountOut);
  });

  it('swapExactInput pre maturity pt-uniBTC to uniBTC', async () => {
    const [owner] = await ethers.getSigners();
    const amountIn = parseUnits('0.05', 8);
    const minAmountOut = amountIn.div(10);

    await ptUniBtc.contract.approve(router.address, amountIn);

    await swapExactInput(owner, false, amountIn, minAmountOut);
  });

  it('swapExactOutput pre maturity uniBTC to pt-uniBTC', async () => {
    const [owner] = await ethers.getSigners();

    const maxAmountIn = parseUnits('0.05', 8);
    const amountOut = parseUnits('0.01', 8);

    console.log(`Balance of ${await uniBtc.contract.balanceOf(owner.address)}`);
    await uniBtc.contract.connect(owner).approve(router.address, maxAmountIn);

    await swapExactOutput(owner, true, maxAmountIn, amountOut);
  });

  it('swapExactOutput pre maturity pt-uniBTC to uniBTC', async () => {
    const [owner] = await ethers.getSigners();

    const maxAmountIn = parseUnits('0.05', 8); // pt-uniBTC
    const amountOut = parseUnits('0.01', 8); // uniBTC

    await ptUniBtc.contract.approve(router.address, maxAmountIn);

    await swapExactOutput(owner, false, maxAmountIn, amountOut);
  });

  it('swapExactInput post maturity uniBTC to ptUniBtc, NotSupported', async () => {
    await postMaturity();
    const [owner] = await ethers.getSigners();

    const amountIn = parseUnits('0.05', 8); // uniBTC
    const minAmountOut = parseUnits('0.05', 8); // pt-uniBTC

    await uniBtc.contract.approve(router.address, amountIn);

    await expect(swapExactInput(owner, true, amountIn, minAmountOut)).to.be.revertedWithCustomError(
      adapter,
      'NotSupported'
    );
  });

  it('swapExactInput post maturity uniBtc to ptUniBtc. NotSupported', async () => {
    await postMaturity();
    const [owner] = await ethers.getSigners();

    const maxAmountIn = parseUnits('0.05', 8); // uniBTC
    const amountOut = parseUnits('0.05', 8); // pt-uniBTC

    await uniBtc.contract.approve(router.address, maxAmountIn);

    await expect(swapExactOutput(owner, true, amountOut, maxAmountIn)).to.be.revertedWithCustomError(
      adapter,
      'NotSupported'
    );
  });

  it('swapExactInput post maturity pt-uniBtc to uniBTC', async () => {
    await postMaturity();
    const [owner] = await ethers.getSigners();

    const amountIn = parseUnits('0.01', 8); // 0.01 pt-uniBtc
    const minAmountOut = amountIn.div(100);

    await ptUniBtc.contract.connect(owner).approve(router.address, amountIn);

    await swapExactInput(owner, false, amountIn, minAmountOut);
  });

  it.only('swapExactOutput post maturity pt-uniBtc to uniBTC', async () => {
    await postMaturity();
    const [user1] = await ethers.getSigners();

    const maxAmountIn = parseUnits('0.015', 8); // pt-uniBTC
    const amountOut = parseUnits('0.01', 8); // uniBTC

    await ptUniBtc.contract.connect(user1).approve(router.address, maxAmountIn);

    await swapExactOutput(user1, false, maxAmountIn, amountOut);
  });

  //   it('swapExactOutput WETH to frxETH. TooMuchRequested', async () => {
  //     const [owner] = await ethers.getSigners();

  //     const maxAmountIn = BigNumber.from(10).pow(15); // 0.0001 WETH
  //     const amountOut = maxAmountIn.mul(1000);

  //     await token0.contract.approve(router.address, maxAmountIn);

  //     await expect(swapExactOutput(owner, true, maxAmountIn, amountOut)).to.be.revertedWith(
  //       'Exchange resulted in fewer coins than expected'
  //     );
  //   });

  //   it('swapExactOutput frxETH to WETH. TooMuchRequested', async () => {
  //     const [owner] = await ethers.getSigners();

  //     const maxAmountIn = BigNumber.from(10).pow(15); // 0.0001 frxETH
  //     const amountOut = maxAmountIn.mul(1000);

  //     await token1.contract.approve(router.address, maxAmountIn);

  //     await expect(swapExactOutput(owner, false, maxAmountIn, amountOut)).to.be.revertedWith(
  //       'Exchange resulted in fewer coins than expected'
  //     );
  //   });
});
