// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../Dex.sol';
import '../UniswapV2LikeSwap.sol';

abstract contract QuickSwap is UniswapV2LikeSwap, DexPoolMapping {
  uint256 private constant QUICK_SWAP_FEE = 997;

  function quickSwapExactInput(
    address pool,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    amountOut = uniswapV2LikeGetAmountOut(pool, amountIn, tokenIn, tokenOut, QUICK_SWAP_FEE);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }

  function quickSwapExactOutput(
    address pool,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    amountIn = uniswapV2LikeGetAmountIn(pool, amountOut, tokenIn, tokenOut, QUICK_SWAP_FEE);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }
}
