// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './interfaces/IMarginlyRouter.sol';
import './dex/dex.sol';
import './dex/UniswapV3Swap.sol';
import './dex/UniswapV2Swap.sol';
import './dex/ApeSwap.sol';
import './dex/BalancerSwap.sol';
import './dex/CamelotSwap.sol';
import './dex/KyberSwap.sol';
import './dex/QuickSwap.sol';
import './dex/TraderJoeSwap.sol';
import './dex/WoofiSwap.sol';

contract MarginlyRouter is
  IMarginlyRouter,
  Ownable,
  UniswapV3Swap,
  ApeSwap,
  BalancerSwap,
  CamelotSwap,
  KyberSwap,
  QuickSwap,
  TraderJoeSwap,
  WooFiSwap
{
  error UnknownDex();

  constructor(PoolInput[] memory pools) DexPoolMapping(pools) {}

  function swapExactInput(
    bytes calldata swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256) {
    require(amountIn != 0, 'zero amount');

    Dex dex;
    if (swapCalldata.length == 0) {
      dex = Dex.UniswapV3;
    } else {
      dex = abi.decode(swapCalldata, (Dex));
    }

    if (dex == Dex.UniswapV3) {
      return uniswapV3SwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.ApeSwap) {
      return apeSwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.Balancer) {
      return balancerSwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.KyberSwap) {
      return kyberSwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.QuickSwap) {
      return quickSwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.SushiSwap) {
      return uniswapV3SwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.Woofi) {
      return wooFiSwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.TraderJoe) {
      return traderJoeSwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else if (dex == Dex.Camelot) {
      return camelotSwapExactInput(dex, tokenIn, tokenOut, amountIn, minAmountOut);
    } else {
      revert UnknownDex();
    }
  }

  function swapExactOutput(
    bytes calldata swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) external returns (uint256) {
    require(amountOut != 0, 'zero amount');

    Dex dex;
    if (swapCalldata.length == 0) {
      dex = Dex.UniswapV3;
    } else {
      dex = abi.decode(swapCalldata, (Dex));
    }

    if (dex == Dex.UniswapV3) {
      return uniswapV3SwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.ApeSwap) {
      return apeSwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.Balancer) {
      return balancerSwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.KyberSwap) {
      return kyberSwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.QuickSwap) {
      return quickSwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.SushiSwap) {
      return uniswapV3SwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.Woofi) {
      return wooFiSwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.TraderJoe) {
      return traderJoeSwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else if (dex == Dex.Camelot) {
      return camelotSwapExactOutput(dex, tokenIn, tokenOut, maxAmountIn, amountOut);
    } else {
      revert UnknownDex();
    }
  }
}
