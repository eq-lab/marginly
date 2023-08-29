// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../abstract/AdapterPoolsStorage.sol';
import '../abstract/UniswapV2LikeSwap.sol';
import '../interfaces/IMarginlyAdapter.sol';
import '../interfaces/IMarginlyRouter.sol';

contract CamelotSwap is IMarginlyAdapter, AdapterPoolsStorage, UniswapV2LikeSwap {
  constructor(PoolInput[] memory pools) AdapterPoolsStorage(pools) {}

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    AdapterCallbackData calldata data
  ) external returns (uint256 amountOut) {
    address pool = getPoolSafe(tokenIn, tokenOut);
    amountOut = ICamelotPair(pool).getAmountOut(amountIn, tokenIn);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    IMarginlyRouter(msg.sender).adapterCallback(pool, amountIn, data);
    uniswapV2LikeSwap(recipient, pool, tokenIn, tokenOut, amountOut);
  }

  function swapExactOutput(
    address /*recipient*/,
    address /*tokenIn*/,
    address /*tokenOut*/,
    uint256 /*amountIn*/,
    uint256 /*minAmountOut*/,
    AdapterCallbackData calldata /*data*/
  ) external pure returns (uint256 /*amountOut*/) {
    revert NotSupported();
  }
}

interface ICamelotPair {
  function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256);
}
