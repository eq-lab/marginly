// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

library UniswapV3Swap {
  struct SwapCallbackData {
    address tokenIn;
    address tokenOut;
    address payer;
  }

  uint160 constant MIN_SQRT_RATIO = 4295128739;
  uint160 constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

  function exactInput(
    address uniswapPoolAddress,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    require(amountIn < 1 << 255);

    bool zeroForOne = tokenIn < tokenOut;
    SwapCallbackData memory data = SwapCallbackData({tokenIn: tokenIn, tokenOut: tokenOut, payer: msg.sender});

    (int256 amount0, int256 amount1) =
      IUniswapV3Pool(uniswapPoolAddress).swap(
        msg.sender,
        zeroForOne,
        int256(amountIn),
        zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
        abi.encode(data)
      );

    amountOut = uint256(-(zeroForOne ? amount1 : amount0));
    require(amountOut > minAmountOut, 'Insufficient amount');
  }


  function exactOutput(
    address uniswapPoolAddress,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    require(amountOut < 1 << 255);

    bool zeroForOne = tokenIn < tokenOut;
    SwapCallbackData memory data = SwapCallbackData({tokenIn: tokenIn, tokenOut: tokenOut, payer: msg.sender});

    (int256 amount0Delta, int256 amount1Delta) =
      IUniswapV3Pool(uniswapPoolAddress).swap(
        msg.sender,
        zeroForOne,
        -int256(amountOut),
        zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
        abi.encode(data)
      );

    uint256 amountOutReceived;
    (amountIn, amountOutReceived) = zeroForOne
      ? (uint256(amount0Delta), uint256(-amount1Delta))
      : (uint256(amount1Delta), uint256(-amount0Delta));
    // it's technically possible to not receive the full output amount,
    // so if no price limit has been specified, require this possibility away
    require(amountOutReceived == amountOut);
    require(amountIn <= maxAmountIn, 'Too much requested');
  }
  
}