// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../Dex.sol';
import '../UniswapV2LikeSwap.sol';

abstract contract TraderJoeSwap is UniswapV2LikeSwap, DexPoolMapping {
  uint256 private constant TRADER_JOE_FEE = 997;

  function traderJoeSwapExactInput(
    address pool,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    amountOut = uniswapV2LikeGetAmountOut(pool, amountIn, tokenIn, tokenOut, TRADER_JOE_FEE);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }

  function traderJoeSwapExactOutput(
    address pool,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    amountIn = uniswapV2LikeGetAmountIn(pool, amountOut, tokenIn, tokenOut, TRADER_JOE_FEE);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }
}
