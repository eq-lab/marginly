// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../abstract/AdapterStorage.sol';
import '../abstract/SwapCallback.sol';

contract KyberSwapElasticAdapter is AdapterStorage, SwapCallback {
  uint160 private constant MIN_SQRT_RATIO = 4295128739;
  uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

  constructor(PoolInput[] memory pools) AdapterStorage(pools) {}

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    AdapterCallbackData calldata data
  ) external returns (uint256 amountOut) {
    require(amountIn < 1 << 255);

    address poolAddress = getPoolSafe(tokenIn, tokenOut);
    CallbackData memory swapData = CallbackData({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      initiator: msg.sender,
      data: data
    });

    (, amountOut) = swap(recipient, poolAddress, tokenIn, tokenOut, true, int256(amountIn), swapData);
    if (amountOut < minAmountOut) revert InsufficientAmount();
  }

  function swapExactOutput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    AdapterCallbackData calldata data
  ) external returns (uint256 amountIn) {
    require(amountOut < 1 << 255);

    address poolAddress = getPoolSafe(tokenIn, tokenOut);
    CallbackData memory swapData = CallbackData({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      initiator: msg.sender,
      data: data
    });

    uint256 amountOutReceived;
    (amountIn, amountOutReceived) = swap(
      recipient,
      poolAddress,
      tokenIn,
      tokenOut,
      false,
      -int256(amountOut),
      swapData
    );
    require(amountOutReceived == amountOut);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  function swap(
    address recipient,
    address pool,
    address tokenIn,
    address tokenOut,
    bool isExactInput,
    int256 swapAmount,
    CallbackData memory data
  ) private returns (uint256 amountIn, uint256 amountOut) {
    uint160 limitSqrtP = tokenIn < tokenOut ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1;

    (int256 amount0Delta, int256 amount1Delta) = IKyberElasticPool(pool).swap(
      recipient,
      swapAmount,
      isExactInput ? tokenIn < tokenOut : tokenOut < tokenIn,
      limitSqrtP,
      abi.encode(data)
    );

    (amountIn, amountOut) = tokenIn < tokenOut
      ? (uint256(amount0Delta), uint256(-amount1Delta))
      : (uint256(amount1Delta), uint256(-amount0Delta));
  }

  function swapCallback(int256 deltaQty0, int256 deltaQty1, bytes calldata data) external {
    swapCallbackInner(deltaQty0, deltaQty1, data);
  }
}

interface IKyberElasticPool {
  function swap(
    address recipient,
    int256 swapQty,
    bool isToken0,
    uint160 limitSqrtP,
    bytes calldata data
  ) external returns (int256 amount0Delta, int256 amount1Delta);
}
