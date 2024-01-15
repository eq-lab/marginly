import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import snapshotGasCost from '@uniswap/snapshot-gas-cost';
import { ethers } from 'hardhat';
import { createUniswapV3TickOracle, Tokens } from './shared/fixtures';
import { formatUnits } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';

describe.only('UniswapV3TickOracle', () => {
  it('getBalancePrice forward', async () => {
    const { oracle, pool } = await loadFixture(createUniswapV3TickOracle);
    const price = await oracle.getBalancePrice(Tokens.USDC, Tokens.WETH);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = sqrtPrice.mul(sqrtPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice forward', async () => {
    const { oracle, pool } = await loadFixture(createUniswapV3TickOracle);
    const price = await oracle.getMargincallPrice(Tokens.USDC, Tokens.WETH);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = sqrtPrice.mul(sqrtPrice);
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getBalancePrice backward', async () => {
    const { oracle, pool } = await loadFixture(createUniswapV3TickOracle);
    const price = await oracle.getBalancePrice(Tokens.WETH, Tokens.USDC);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = BigNumber.from(1n << 96n).mul(1n << 96n).div(sqrtPrice.mul(sqrtPrice));
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });

  it('getMargincallPrice backward', async () => {
    const { oracle, pool } = await loadFixture(createUniswapV3TickOracle);
    const price = await oracle.getMargincallPrice(Tokens.WETH, Tokens.USDC);

    const sqrtPrice = await pool.token1ToToken0SqrtPriceX96();
    const intendedPrice = BigNumber.from(1n << 96n).mul(1n << 96n).div(sqrtPrice.mul(sqrtPrice));
    expect(price).to.be.closeTo(intendedPrice, intendedPrice.div(10000));
  });
});
