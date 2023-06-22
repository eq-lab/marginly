// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './interfaces/IMarginlyRouter.sol';
import './dex/dex.sol';
import './dex/UniswapV3Swap.sol';


contract MarginlyRouter is IMarginlyRouter, Ownable, IUniswapV3SwapCallback {
  error UnknownDex();

  bool public debug;
  int256 public debug0;
  int256 public debug1;

  address immutable uniswap;

  constructor(address _uniswap) {
    uniswap = _uniswap;
  }

  function swapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256) {
    if (dex == Dex.UniswapV3) {
      return UniswapV3Swap.exactInput(uniswap, tokenIn, tokenOut, amountIn, minAmountOut);
    // } else if (dex == Dex.ApeSwap) {
    //   ApeSwap.apeSwapExactInput(swapRouter, tokenIn, tokenOut, amountIn, minAmountOut);
    // } else if (dex == Dex.Balancer) {
    //   BalancerSwap.balancerSwapExactInput(swapRouter, tokenIn, tokenOut, amountIn, minAmountOut);
    // } else if (dex == Dex.KyberSwap) {
    //   KyberSwap.kyberSwapExactInput(swapRouter, tokenIn, tokenOut, amountIn, minAmountOut);
    // } else if (dex == Dex.QuickSwap) {
    //   QuickSwap.quickSwapExactInput(swapRouter, tokenIn, tokenOut, amountIn, minAmountOut);
    // } else if (dex == Dex.SushiSwap) {
    //   SushiSwap.sushiSwapExactInput(swapRouter, tokenIn, tokenOut, amountIn, minAmountOut);
    // } else if (dex == Dex.Woofi) {
    //   WoofiSwap.woofiSwapExactInput(swapRouter, tokenIn, tokenOut, amountIn, minAmountOut);
    } else {
      revert UnknownDex();
    }
  }

  function swapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) external returns (uint256) {
    if (dex == Dex.UniswapV3) {
      return UniswapV3Swap.exactOutput(uniswap, tokenIn, tokenOut, maxAmountIn, amountOut);
    // } else if (dex == Dex.ApeSwap) {
    //   ApeSwap.apeSwapExactOutput(swapRouter, tokenIn, tokenOut, maxAmountIn, amountOut);
    // } else if (dex == Dex.Balancer) {
    //   BalancerSwap.balancerSwapExactOutput(swapRouter, tokenIn, tokenOut, maxAmountIn, amountOut);
    // } else if (dex == Dex.KyberSwap) {
    //   KyberSwap.kyberSwapExactOutput(swapRouter, tokenIn, tokenOut, maxAmountIn, amountOut);
    // } else if (dex == Dex.QuickSwap) {
    //   QuickSwap.quickSwapExactOutput(swapRouter, tokenIn, tokenOut, maxAmountIn, amountOut);
    // } else if (dex == Dex.SushiSwap) {
    //   SushiSwap.sushiSwapExactOutput(swapRouter, tokenIn, tokenOut, maxAmountIn, amountOut);
    // } else if (dex == Dex.Woofi) {
    //   WoofiSwap.woofiSwapExactOutput(swapRouter, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else {
      revert UnknownDex();
    }
  }

  function uniswapV3SwapCallback(
    int256 amount0Delta,
    int256 amount1Delta,
    bytes calldata _data
  ) external override {
    debug0 = amount0Delta;
    debug1 = amount1Delta;
    require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
    UniswapV3Swap.SwapCallbackData memory data = abi.decode(_data, (UniswapV3Swap.SwapCallbackData));
    (address tokenIn, address tokenOut) = (data.tokenIn, data.tokenOut);
    require(msg.sender == uniswap);

    (bool isExactInput, uint256 amountToPay) =
      amount0Delta > 0
        ? (tokenIn < tokenOut, uint256(amount0Delta))
        : (tokenOut < tokenIn, uint256(amount1Delta));
    debug = isExactInput;
    if (isExactInput) {
      TransferHelper.safeTransferFrom(tokenIn, data.payer, msg.sender, amountToPay);
    } else {
      TransferHelper.safeTransferFrom(tokenOut, data.payer, msg.sender, amountToPay);
    }
  }
}
