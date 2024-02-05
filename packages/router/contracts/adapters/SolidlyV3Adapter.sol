// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '../abstract/SwapCallback.sol';
import '../abstract/UniswapV3LikeSwap.sol';

contract SolidlyV3Adapter is UniswapV3LikeSwap, SwapCallback {
  constructor(PoolInput[] memory pools) AdapterStorage(pools) {}

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) external returns (uint256 amountOut) {
    require(amountIn < 1 << 255);

    address poolAddress = getPoolSafe(tokenIn, tokenOut);
    bool zeroForOne = tokenIn < tokenOut;
    CallbackData memory swapData = CallbackData({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      initiator: msg.sender,
      data: data
    });

    (, amountOut) = uniswapV3LikeSwap(recipient, poolAddress, zeroForOne, int256(amountIn), swapData);
    if (amountOut < minAmountOut) revert InsufficientAmount();
  }

  function swapExactOutput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    bytes calldata data
  ) external returns (uint256 amountIn) {
    require(amountOut < 1 << 255);

    address poolAddress = getPoolSafe(tokenIn, tokenOut);
    bool zeroForOne = tokenIn < tokenOut;
    CallbackData memory swapData = CallbackData({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      initiator: msg.sender,
      data: data
    });

    uint256 amountOutReceived;
    (amountIn, amountOutReceived) = uniswapV3LikeSwap(recipient, poolAddress, zeroForOne, -int256(amountOut), swapData);
    require(amountOutReceived == amountOut);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  function solidlyV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
    swapCallbackInner(amount0Delta, amount1Delta, data);
  }
}
