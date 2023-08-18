// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../Dex.sol';
import '../UniswapV2LikeSwap.sol';

abstract contract CamelotSwap is UniswapV2LikeSwap {
  function camelotSwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    address pool = dexPoolMapping[dex][tokenIn][tokenOut];
    amountOut = ICamelotPair(pool).getAmountOut(amountIn, tokenIn);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }
}

interface ICamelotPair {
  function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256);
}
