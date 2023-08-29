// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../abstract/SwapCallback.sol';
import '../abstract/UniswapV3LikeSwap.sol';
import '../interfaces/IMarginlyAdapter.sol';

contract UniswapV3Swap is IMarginlyAdapter, UniswapV3LikeSwap, SwapCallback {
  constructor(PoolInput[] memory pools) AdapterPoolsStorage(pools) {}

  function swapExactInput(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256 amountOut) {
    require(amountIn < 1 << 255);

    address poolAddress = getPoolSafe(tokenIn, tokenOut);
    bool zeroForOne = tokenIn < tokenOut;
    CallbackData memory data = CallbackData({tokenIn: tokenIn, tokenOut: tokenOut, payer: msg.sender});

    (, amountOut) = uniswapV3LikeSwap(poolAddress, zeroForOne, int256(amountIn), data);
    if (amountOut < minAmountOut) revert InsufficientAmount();
  }

  function swapExactOutput(
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) external returns (uint256 amountIn) {
    require(amountOut < 1 << 255);

    address poolAddress = getPoolSafe(tokenIn, tokenOut);
    bool zeroForOne = tokenIn < tokenOut;
    CallbackData memory data = CallbackData({tokenIn: tokenIn, tokenOut: tokenOut, payer: msg.sender});

    uint256 amountOutReceived;
    (amountIn, amountOutReceived) = uniswapV3LikeSwap(poolAddress, zeroForOne, -int256(amountOut), data);
    require(amountOutReceived == amountOut);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
    swapCallbackInner(amount0Delta, amount1Delta, data);
  }
}
