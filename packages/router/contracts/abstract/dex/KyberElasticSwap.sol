// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../Dex.sol';
import '../SwapCallback.sol';
import '../UniswapV3LikeSwap.sol';

abstract contract KyberElasticSwap is UniswapV3LikeSwap, SwapCallback {
  function kyberElasticSwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    address poolAddress = dexPoolMapping[dex][tokenIn][tokenOut];
    bool zeroForOne = tokenIn < tokenOut;
    CallbackData memory data = CallbackData({dex: dex, tokenIn: tokenIn, tokenOut: tokenOut, payer: msg.sender});

    (, amountOut) = uniswapV3LikeSwap(poolAddress, zeroForOne, int256(amountIn), data);
    require(amountOut >= minAmountOut, 'Insufficient amount');
  }

  function kyberElasticSwapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    require(amountOut < 1 << 255);

    address poolAddress = dexPoolMapping[dex][tokenIn][tokenOut];
    bool zeroForOne = tokenIn < tokenOut;
    CallbackData memory data = CallbackData({dex: dex, tokenIn: tokenIn, tokenOut: tokenOut, payer: msg.sender});

    uint256 amountOutReceived;
    (amountIn, amountOutReceived) = uniswapV3LikeSwap(poolAddress, zeroForOne, -int256(amountOut), data);
    require(amountOutReceived == amountOut);
    require(amountIn <= maxAmountIn, 'Too much requested');
  }

  function swapCallback(int256 deltaQty0, int256 deltaQty1, bytes calldata data) external {
    swapCallbackInner(deltaQty0, deltaQty1, data);
  }
}
