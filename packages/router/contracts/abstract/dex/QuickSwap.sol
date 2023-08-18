// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';

import '../Dex.sol';
import '../UniswapV2LikeSwap.sol';

abstract contract QuickSwap is UniswapV2LikeSwap {
  using LowGasSafeMath for uint256;

  function quickSwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    address pool = dexPoolMapping[dex][tokenIn][tokenOut];
    amountOut = quickSwapGetAmountOut(pool, amountIn, tokenIn, tokenOut);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }

  function quickSwapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    address pool = dexPoolMapping[dex][tokenIn][tokenOut];
    amountIn = quickSwapGetAmountIn(pool, amountOut, tokenIn, tokenOut);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }

  function quickSwapGetAmountOut(
    address pool,
    uint amountIn,
    address tokenIn,
    address tokenOut
  ) internal view returns (uint amountOut) {
    (uint reserveIn, uint reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint amountInWithFee = amountIn.mul(997);
    uint numerator = amountInWithFee.mul(reserveOut);
    uint denominator = reserveIn.mul(1000).add(amountInWithFee);
    amountOut = numerator / denominator;
  }

  function quickSwapGetAmountIn(
    address pool,
    uint amountOut,
    address tokenIn,
    address tokenOut
  ) internal view returns (uint amountIn) {
    (uint reserveIn, uint reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint numerator = reserveIn.mul(amountOut).mul(1000);
    uint denominator = reserveOut.sub(amountOut).mul(997);
    amountIn = (numerator / denominator).add(1);
  }
}
