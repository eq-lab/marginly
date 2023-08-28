// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../Dex.sol';
import '../SwapCallback.sol';

abstract contract KyberElasticSwap is SwapCallback {
  uint160 private constant MIN_SQRT_RATIO = 4295128739;
  uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

  function kyberElasticSwapExactInput(
    uint256 dexIndex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    require(amountIn < 1 << 255);
    address poolAddress = getPool[dexIndex][tokenIn][tokenOut].pool;
    CallbackData memory data = CallbackData({dex: dexIndex, tokenIn: tokenIn, tokenOut: tokenOut, payer: msg.sender});

    (, amountOut) = swap(poolAddress, tokenIn, tokenOut, true, int256(amountIn), data);
    if (amountOut < minAmountOut) revert InsufficientAmount();
  }

  function kyberElasticSwapExactOutput(
    uint256 dexIndex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    require(amountOut < 1 << 255);
    address poolAddress = getPool[dexIndex][tokenIn][tokenOut].pool;
    CallbackData memory data = CallbackData({dex: dexIndex, tokenIn: tokenIn, tokenOut: tokenOut, payer: msg.sender});

    uint256 amountOutReceived;
    (amountIn, amountOutReceived) = swap(poolAddress, tokenIn, tokenOut, false, -int256(amountOut), data);
    require(amountOutReceived == amountOut);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  function swap(
    address pool,
    address tokenIn,
    address tokenOut,
    bool isExactInput,
    int256 swapAmount,
    CallbackData memory data
  ) private returns (uint256 amountIn, uint256 amountOut) {
    uint160 limitSqrtP = tokenIn < tokenOut ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1;

    (int256 amount0Delta, int256 amount1Delta) = IKyberElasticPool(pool).swap(
      msg.sender,
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
