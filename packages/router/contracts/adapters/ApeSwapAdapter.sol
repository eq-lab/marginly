// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../abstract/AdapterStorage.sol';
import '../abstract/UniswapV2LikeSwap.sol';
import '../interfaces/IMarginlyRouter.sol';

contract ApeSwapAdapter is AdapterStorage, UniswapV2LikeSwap {
  uint256 private constant APE_SWAP_FEE = 998;

  constructor(PoolInput[] memory pools) AdapterStorage(pools) {}

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    AdapterCallbackData calldata data
  ) external returns (uint256 amountOut) {
    address pool = getPoolSafe(tokenIn, tokenOut);
    amountOut = uniswapV2LikeGetAmountOut(pool, amountIn, tokenIn, tokenOut, APE_SWAP_FEE);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    IMarginlyRouter(msg.sender).adapterCallback(pool, amountIn, data);
    uniswapV2LikeSwap(recipient, pool, tokenIn, tokenOut, amountOut);
  }

  function swapExactOutput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    AdapterCallbackData calldata data
  ) external returns (uint256 amountIn) {
    address pool = getPoolSafe(tokenIn, tokenOut);
    amountIn = uniswapV2LikeGetAmountIn(pool, amountOut, tokenIn, tokenOut, APE_SWAP_FEE);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
    IMarginlyRouter(msg.sender).adapterCallback(pool, amountOut, data);
    uniswapV2LikeSwap(recipient, pool, tokenIn, tokenOut, amountOut);
  }
}
