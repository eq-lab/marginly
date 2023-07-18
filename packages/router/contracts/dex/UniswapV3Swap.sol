// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './dex.sol';

struct UniswapSwapV3CallbackData {
  Dex dex;
  address tokenIn;
  address tokenOut;
  address payer;
}

abstract contract UniswapV3Swap is IUniswapV3SwapCallback, DexPoolMapping {
  uint160 constant MIN_SQRT_RATIO = 4295128739;
  uint160 constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

  function uniswapV3SwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    require(amountIn < 1 << 255);

    address poolAddress = dexPoolMapping[dex][tokenIn][tokenOut].pool;
    bool zeroForOne = tokenIn < tokenOut;
    UniswapSwapV3CallbackData memory data = UniswapSwapV3CallbackData({
      dex: dex,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      payer: msg.sender
    });

    (int256 amount0, int256 amount1) = IUniswapV3Pool(poolAddress).swap(
      msg.sender,
      zeroForOne,
      int256(amountIn),
      zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
      abi.encode(data)
    );

    amountOut = uint256(-(zeroForOne ? amount1 : amount0));
    require(amountOut > minAmountOut, 'Insufficient amount');
  }

  function uniswapV3SwapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    require(amountOut < 1 << 255);

    address poolAddress = dexPoolMapping[dex][tokenIn][tokenOut].pool;
    bool zeroForOne = tokenIn < tokenOut;
    UniswapSwapV3CallbackData memory data = UniswapSwapV3CallbackData({
      dex: dex,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      payer: msg.sender
    });

    (int256 amount0Delta, int256 amount1Delta) = IUniswapV3Pool(poolAddress).swap(
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

  function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external override {
    require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
    UniswapSwapV3CallbackData memory data = abi.decode(_data, (UniswapSwapV3CallbackData));
    (address tokenIn, address tokenOut, Dex dex) = (data.tokenIn, data.tokenOut, data.dex);
    require(msg.sender != address(0));
    require(msg.sender == dexPoolMapping[dex][tokenIn][tokenOut].pool);

    (bool isExactInput, uint256 amountToPay) = amount0Delta > 0
      ? (tokenIn < tokenOut, uint256(amount0Delta))
      : (tokenOut < tokenIn, uint256(amount1Delta));
    if (isExactInput) {
      TransferHelper.safeTransferFrom(tokenIn, data.payer, msg.sender, amountToPay);
    } else {
      TransferHelper.safeTransferFrom(tokenOut, data.payer, msg.sender, amountToPay);
    }
  }
}
