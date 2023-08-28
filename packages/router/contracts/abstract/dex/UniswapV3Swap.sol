// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../Dex.sol';
import '../SwapCallback.sol';
import '../UniswapV3LikeSwap.sol';

abstract contract UniswapV3Swap is UniswapV3LikeSwap, SwapCallback {
  function uniswapV3SwapExactInput(
    uint256 dexIndex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    require(amountIn < 1 << 255);
    address poolAddress = getPool[dexIndex][tokenIn][tokenOut].pool;
    bool zeroForOne = tokenIn < tokenOut;
    CallbackData memory data = CallbackData({dex: dexIndex, tokenIn: tokenIn, tokenOut: tokenOut, payer: msg.sender});

    (, amountOut) = uniswapV3LikeSwap(poolAddress, zeroForOne, int256(amountIn), data);
    if (amountOut < minAmountOut) revert InsufficientAmount();
  }

  function uniswapV3SwapExactOutput(
    uint256 dexIndex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    require(amountOut < 1 << 255);
    address poolAddress = getPool[dexIndex][tokenIn][tokenOut].pool;
    bool zeroForOne = tokenIn < tokenOut;
    CallbackData memory data = CallbackData({dex: dexIndex, tokenIn: tokenIn, tokenOut: tokenOut, payer: msg.sender});

    uint256 amountOutReceived;
    (amountIn, amountOutReceived) = uniswapV3LikeSwap(poolAddress, zeroForOne, -int256(amountOut), data);
    require(amountOutReceived == amountOut);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
    swapCallbackInner(amount0Delta, amount1Delta, data);
  }
}
