// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';

import './dex.sol';
import './UniswapV2Swap.sol';

abstract contract CamelotSwap is UniswapV2Swap {
  using LowGasSafeMath for uint256;

  function camelotSwapGetAmountOut(
    address pool,
    uint amountIn,
    address tokenIn,
    address tokenOut
  ) internal view returns (uint amountOut) {
    (uint reserveIn, uint reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint16 fee = tokenIn < tokenOut ? ICamelotPair(pool).token0FeePercent() : ICamelotPair(pool).token1FeePercent();
    uint amountInWithFee = amountIn.mul(fee);
    uint numerator = amountInWithFee.mul(reserveOut);
    uint denominator = reserveIn.mul(100000).add(amountInWithFee);
    amountOut = numerator / denominator;
  }

  function camelotSwapGetAmountIn(
    address pool,
    uint amountOut,
    address tokenIn,
    address tokenOut
  ) internal view returns (uint amountIn) {
    (uint reserveIn, uint reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint numerator = reserveIn.mul(amountOut).mul(100000);
    uint16 fee = tokenIn < tokenOut ? ICamelotPair(pool).token0FeePercent() : ICamelotPair(pool).token1FeePercent();
    uint denominator = reserveOut.sub(amountOut).mul(fee);
    amountIn = (numerator / denominator).add(1);
  }
}

interface ICamelotPair {
  function token0FeePercent() external view returns (uint16);

  function token1FeePercent() external view returns (uint16);
}
