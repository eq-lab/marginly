// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './interfaces/IMarginlyRouter.sol';
import './dex/dex.sol';
import './dex/UniswapV3Swap.sol';
import './dex/UniswapV2Swap.sol';
import './dex/BalancerSwap.sol';

contract MarginlyRouter is IMarginlyRouter, Ownable, UniswapV3Swap, UniswapV2Swap, BalancerSwap {
  error UnknownDex();

  constructor(address uniswapV3Factory, address apeSwapFactory, address balancerVault) {
    dexFactoryList[Dex.UniswapV3] = uniswapV3Factory;
    dexFactoryList[Dex.ApeSwap] = apeSwapFactory;
    dexFactoryList[Dex.Balancer] = balancerVault;
  }

  function swapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256) {
    require(amountIn != 0, 'zero amount');

    if (dex == Dex.UniswapV3) {
      return uniswapV3SwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.ApeSwap) {
      return uniswapV2SwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.Balancer) {
      return balancerSwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
      // } else if (dex == Dex.KyberSwap) {
      //   KyberSwap.kyberSwapExactInput(swapRouter, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.QuickSwap) {
      return uniswapV2SwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.SushiSwap) {
      return uniswapV3SwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
      // } else if (dex == Dex.Woofi) {
      //   WoofiSwap.woofiSwapExactInput(swapRouter, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.TraderJoe) {
      return uniswapV2SwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.Camelot) {
      return uniswapV2SwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
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
    require(amountOut != 0, 'zero amount');

    if (dex == Dex.UniswapV3) {
      return uniswapV3SwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.ApeSwap) {
      // FIXME fee 2%
      return uniswapV2SwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.Balancer) {
      return balancerSwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
      // } else if (dex == Dex.KyberSwap) {
      //   KyberSwap.kyberSwapExactOutput(swapRouter, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.QuickSwap) {
      return uniswapV2SwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.SushiSwap) {
      return uniswapV3SwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
      // } else if (dex == Dex.Woofi) {
      //   WoofiSwap.woofiSwapExactOutput(swapRouter, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.TraderJoe) {
      return uniswapV2SwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.Camelot) {
      return uniswapV2SwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else {
      revert UnknownDex();
    }
  }
}
