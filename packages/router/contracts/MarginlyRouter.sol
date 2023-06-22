// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './interfaces/IMarginlyRouter.sol';
import './dex/dex.sol';
import './dex/UniswapV3Swap.sol';

contract MarginlyRouter is IMarginlyRouter, Ownable, UniswapV3Swap {
  error UnknownDex();

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
}
