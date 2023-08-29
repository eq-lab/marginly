// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../abstract/AdapterPoolsStorage.sol';
import '../abstract/UniswapV2LikeSwap.sol';
import '../interfaces/IMarginlyAdapter.sol';

contract SushiSwap is IMarginlyAdapter, AdapterPoolsStorage, UniswapV2LikeSwap {
  uint256 private constant SUSHI_SWAP_FEE = 997;

  constructor(PoolInput[] memory pools) AdapterPoolsStorage(pools) {}

  function swapExactInput(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256 amountOut) {
    address pool = getPoolSafe(tokenIn, tokenOut);
    amountOut = uniswapV2LikeGetAmountOut(pool, amountIn, tokenIn, tokenOut, SUSHI_SWAP_FEE);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }

  function swapExactOutput(
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) external returns (uint256 amountIn) {
    address pool = getPoolSafe(tokenIn, tokenOut);
    amountIn = uniswapV2LikeGetAmountIn(pool, amountOut, tokenIn, tokenOut, SUSHI_SWAP_FEE);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }
}
