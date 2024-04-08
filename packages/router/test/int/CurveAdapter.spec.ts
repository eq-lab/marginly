import { ethers } from 'hardhat';
import { CurveAdapter, ERC20, ICurvePool, MarginlyRouter } from '../../typechain-types';
import { AdapterInputStruct } from '@marginly/periphery/typechain-types/contracts/admin/abstract/RouterActions';
import { PoolInputStruct } from '../../typechain-types/contracts/adapters/CurveAdapter';
import { BigNumber } from 'ethers';
import { EthAddress } from '@marginly/common';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ArbMainnetERC20BalanceOfSlot, setTokenBalance } from '../shared/tokens';

interface TokenInfo {
  contract: ERC20;
  symbol: string;
  decimals: number;
  balanceOfSlot: string;
}

function formatTokenBalance(token: TokenInfo, amount: BigNumber): string {
  return `${ethers.utils.formatUnits(amount, token.decimals)} ${token.symbol}`;
}

describe('Curve adapter for frxETH/WETH pool (CurveAdapter)', () => {
  // rxETH/WETH pool - https://curve.fi/#/arbitrum/pools/factory-v2-140/deposit
  const poolAddress = '0x1DeB3b1cA6afca0FF9C5cE9301950dC98Ac0D523';
  let token0: TokenInfo;
  let token1: TokenInfo;
  let pool: ICurvePool;
  let router: MarginlyRouter;
  let adapter: CurveAdapter;

  before(async () => {
    pool = await ethers.getContractAt('ICurvePool', poolAddress);
    const adapterFactory = await ethers.getContractFactory('CurveAdapter');

    const token0Address = await pool.callStatic.coins(0);
    const token1Address = await pool.callStatic.coins(1);
    const token0Contract = await ethers.getContractAt('ERC20', token0Address);
    const token1Contract = await ethers.getContractAt('ERC20', token1Address);
    const token0Symbol = await token0Contract.symbol();
    const token1Symbol = await token1Contract.symbol();
    const token0Decimals = await token0Contract.decimals();
    const token1Decimals = await token1Contract.decimals();

    token0 = <TokenInfo>{
      contract: token0Contract,
      symbol: token0Symbol,
      decimals: token0Decimals,
      balanceOfSlot: ArbMainnetERC20BalanceOfSlot.WETH,
    };
    token1 = <TokenInfo>{
      contract: token1Contract,
      symbol: token1Symbol,
      decimals: token1Decimals,
      balanceOfSlot: ArbMainnetERC20BalanceOfSlot.FRXETH,
    };
    adapter = await adapterFactory.deploy([
      <PoolInputStruct>{ token0: token0Address, token1: token1Address, pool: poolAddress },
    ]);

    const routerFactory = await ethers.getContractFactory('MarginlyRouter');
    router = await routerFactory.deploy([<AdapterInputStruct>{ dexIndex: 0, adapter: adapter.address }]);

    const [owner, user1, user2] = await ethers.getSigners();

    const token0InitBalance = BigNumber.from(10).pow(18);
    await setTokenBalance(token0Address, token0.balanceOfSlot, EthAddress.parse(owner.address), token0InitBalance);
    await setTokenBalance(token0Address, token0.balanceOfSlot, EthAddress.parse(user1.address), token0InitBalance);
    await setTokenBalance(token0Address, token0.balanceOfSlot, EthAddress.parse(user2.address), token0InitBalance);

    const token1InitBalance = BigNumber.from(10).pow(19);
    await setTokenBalance(token1Address, token1.balanceOfSlot, EthAddress.parse(owner.address), token1InitBalance);
    await setTokenBalance(token1Address, token1.balanceOfSlot, EthAddress.parse(user1.address), token1InitBalance);
    await setTokenBalance(token1Address, token1.balanceOfSlot, EthAddress.parse(user2.address), token1InitBalance);
  });

  function printPrice(priceInToken0: BigNumber) {
    const priceStr = ethers.utils.formatEther(priceInToken0);
    const inversePrice = 1 / Number.parseFloat(priceStr);
    console.log(`1 ${token1.symbol} = ${priceStr} ${token0.symbol}`);
    console.log(`1 ${token0.symbol} = ${inversePrice} ${token1.symbol}`);
  }

  function printPriceWithDelta(newPriceInToken0: BigNumber, oldPriceInToken0: BigNumber) {
    const newPriceStr = ethers.utils.formatEther(newPriceInToken0);
    const inverseNewPrice = 1 / Number.parseFloat(newPriceStr);

    const oldPriceStr = ethers.utils.formatEther(oldPriceInToken0);
    const inverseOldPrice = 1 / Number.parseFloat(oldPriceStr);

    const deltaPrice = newPriceInToken0.sub(oldPriceInToken0);
    const deltaPriceStr = ethers.utils.formatEther(deltaPrice);
    const deltaInversePrice = inverseNewPrice - inverseOldPrice;

    console.log(`1 ${token1.symbol} = ${newPriceStr} ${token0.symbol}, delta: ${deltaPriceStr} ${token0.symbol}`);
    console.log(
      `1 ${token0.symbol} = ${inverseNewPrice} ${token1.symbol}, ` + `delta: ${deltaInversePrice} ${token1.symbol}`
    );
  }

  async function swapExactInput(
    signer: SignerWithAddress,
    zeroToOne: boolean,
    amountIn: BigNumber,
    minAmountOut: BigNumber
  ) {
    const inToken = zeroToOne ? token0 : token1;
    const outToken = zeroToOne ? token1 : token0;
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

    const priceInToken0Before = await pool.last_price();

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
  }

  async function swapExactOutput(
    signer: SignerWithAddress,
    zeroToOne: boolean,
    maxAmountIn: BigNumber,
    amountOut: BigNumber
  ) {
    const inToken = zeroToOne ? token0 : token1;
    const outToken = zeroToOne ? token1 : token0;
    const inTokenBalanceBefore = await inToken.contract.balanceOf(signer.address);
    const outTokenBalanceBefore = await outToken.contract.balanceOf(signer.address);

    console.log(
      `signer balance before swap: ${formatTokenBalance(inToken, inTokenBalanceBefore)}, ` +
        `${formatTokenBalance(outToken, outTokenBalanceBefore)}`
    );
    const maxAmountInStr = formatTokenBalance(inToken, maxAmountIn);
    const amountOutStr = formatTokenBalance(outToken, amountOut);

    console.log(`swapExactInput:`);
    console.log(`maxAmountIn: ${maxAmountInStr}`);
    console.log(`minAmountOut: ${amountOutStr}`);

    const priceInToken0Before = await pool.last_price();

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
  }

  it('swapExactInput WETH to frxETH', async () => {
    const [owner] = await ethers.getSigners();
    const amountIn = BigNumber.from(10).pow(15); // 0.0001 WETH
    const minAmountOut = amountIn.div(100);

    await token0.contract.approve(router.address, amountIn);

    await swapExactInput(owner, true, amountIn, minAmountOut);
  });

  it('swapExactInput frxETH to WETH', async () => {
    const [owner] = await ethers.getSigners();
    const amountIn = BigNumber.from(10).pow(15); // 0.0001 frxETH
    const minAmountOut = amountIn.div(10);

    await token1.contract.approve(router.address, amountIn);

    await swapExactInput(owner, false, amountIn, minAmountOut);
  });

  it('swapExactOutput frxETH to WETH', async () => {
    const [owner] = await ethers.getSigners();

    const maxAmountIn = BigNumber.from(10).pow(15); // 0.0001 frxETH
    const amountOut = maxAmountIn.div(100);

    await token1.contract.approve(router.address, maxAmountIn);

    await swapExactOutput(owner, false, maxAmountIn, amountOut);
  });

  it('swapExactOutput WETH to frxETH', async () => {
    const [owner] = await ethers.getSigners();

    const maxAmountIn = BigNumber.from(10).pow(15); // 0.0001 frxETH
    const amountOut = maxAmountIn.div(100);

    await token0.contract.approve(router.address, maxAmountIn);

    await swapExactOutput(owner, true, maxAmountIn, amountOut);
  });

  it('swapExactInput WETH to frxETH. TooMuchRequested', async () => {
    const [owner] = await ethers.getSigners();
    const amountIn = BigNumber.from(10).pow(15); // 0.0001 WETH
    const minAmountOut = amountIn.mul(1000);

    await token0.contract.approve(router.address, amountIn);

    await expect(swapExactInput(owner, true, amountIn, minAmountOut)).to.be.revertedWith(
      'Exchange resulted in fewer coins than expected'
    );
  });

  it('swapExactInput frxETH to WETH. TooMuchRequested', async () => {
    const [owner] = await ethers.getSigners();
    const amountIn = BigNumber.from(10).pow(15); // 0.0001 frxETH
    const minAmountOut = amountIn.mul(1000);

    await token1.contract.approve(router.address, amountIn);

    await expect(swapExactInput(owner, false, amountIn, minAmountOut)).to.be.revertedWith(
      'Exchange resulted in fewer coins than expected'
    );
  });

  it('swapExactOutput WETH to frxETH. TooMuchRequested', async () => {
    const [owner] = await ethers.getSigners();

    const maxAmountIn = BigNumber.from(10).pow(15); // 0.0001 WETH
    const amountOut = maxAmountIn.mul(1000);

    await token0.contract.approve(router.address, maxAmountIn);

    await expect(swapExactOutput(owner, true, maxAmountIn, amountOut)).to.be.revertedWith(
      'Exchange resulted in fewer coins than expected'
    );
  });

  it('swapExactOutput frxETH to WETH. TooMuchRequested', async () => {
    const [owner] = await ethers.getSigners();

    const maxAmountIn = BigNumber.from(10).pow(15); // 0.0001 frxETH
    const amountOut = maxAmountIn.mul(1000);

    await token1.contract.approve(router.address, maxAmountIn);

    await expect(swapExactOutput(owner, false, maxAmountIn, amountOut)).to.be.revertedWith(
      'Exchange resulted in fewer coins than expected'
    );
  });
});
