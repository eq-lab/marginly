import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import snapshotGasCost from '@uniswap/snapshot-gas-cost';
import { ethers } from 'hardhat';
import { createUniswapV3TickOracle, Tokens } from './shared/fixtures';
import { AbiCoder } from '@ethersproject/abi';
import { formatUnits } from 'ethers/lib/utils';

function encodeOptions(secondsAgo: number, fee: number) {
  return ethers.utils.defaultAbiCoder.encode(
    ['uint16', 'uint24'],
    [secondsAgo, fee]
  );
}

describe.only('UniswapV3TickOracle', () => {
  it('', async () => {
    const { oracle, pool } = await loadFixture(createUniswapV3TickOracle);
    const price = await oracle.getBalancePrice(Tokens.USDC, Tokens.WETH, encodeOptions(900, await pool.fee()));
    console.log(formatUnits(price.div(1n << 96n), 12));

    console.log(`${await pool.token1ToToken0SqrtPriceX96()}`);
    console.log(`${await pool.tickCumulativesSecond()}`);
  });
});
