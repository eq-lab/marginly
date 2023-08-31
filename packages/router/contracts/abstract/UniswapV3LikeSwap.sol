// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import './SwapCallback.sol';

abstract contract UniswapV3LikeSwap {
  uint160 constant MIN_SQRT_RATIO = 4295128739;
  uint160 constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

  function uniswapV3LikeSwap(
    address recipient,
    address pool,
    bool zeroForOne,
    int256 swapAmount,
    CallbackData memory data
  ) internal returns (uint256 amountIn, uint256 amountOut) {
    (int256 amount0Delta, int256 amount1Delta) = IUniswapV3Pool(pool).swap(
      recipient,
      zeroForOne,
      swapAmount,
      zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
      abi.encode(data)
    );

    (amountIn, amountOut) = zeroForOne
      ? (uint256(amount0Delta), uint256(-amount1Delta))
      : (uint256(amount1Delta), uint256(-amount0Delta));
  }
}
