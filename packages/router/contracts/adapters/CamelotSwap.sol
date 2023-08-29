// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../abstract/AdapterPoolsStorage.sol';
import '../abstract/UniswapV2LikeSwap.sol';
import '../interfaces/IMarginlyAdapter.sol';

contract CamelotSwap is IMarginlyAdapter, AdapterPoolsStorage, UniswapV2LikeSwap {
  constructor(PoolInput[] memory pools) AdapterPoolsStorage(pools) {}

  function swapExactInput(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256 amountOut) {
    address pool = getPoolSafe(tokenIn, tokenOut);
    amountOut = ICamelotPair(pool).getAmountOut(amountIn, tokenIn);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }

  function swapExactOutput(
    address /*tokenIn*/,
    address /*tokenOut*/,
    uint256 /*amountIn*/,
    uint256 /*minAmountOut*/
  ) external pure returns (uint256 /*amountOut*/) {
    revert NotSupported();
  }
}

interface ICamelotPair {
  function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256);
}
