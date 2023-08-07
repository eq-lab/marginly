// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './interfaces/IMarginlyRouter.sol';
import './libraries/SwapsDecoder.sol';

import './dex/dex.sol';
import './dex/UniswapV3Swap.sol';
import './dex/UniswapV2Swap.sol';
import './dex/ApeSwap.sol';
import './dex/BalancerSwap.sol';
import './dex/CamelotSwap.sol';
import './dex/KyberSwap.sol';
import './dex/SushiSwap.sol';
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
  SushiSwap,
  TraderJoeSwap,
  WooFiSwap
{
  constructor(PoolInput[] memory pools, address balancerVault) DexPoolMapping(pools) BalancerSwap(balancerVault) {}

  function swapExactInput(
    uint256 swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256 amountOut) {
    require(amountIn != 0, 'zero amount');

    (SwapsDecoder.SwapInfo[] memory swapInfos, uint256 swapsNumber) = SwapsDecoder.decodeSwapInfo(swapCalldata);

    for(uint256 i; i < swapsNumber; ++i){
      Dex dex = swapInfos[i].dex;
      uint256 dexAmountIn = Math.mulDiv(amountIn, swapInfos[i].swapRatio, SwapsDecoder.ONE);
      uint256 dexMinAmountOut = Math.mulDiv(minAmountOut, swapInfos[i].swapRatio, SwapsDecoder.ONE);

      if (dex == Dex.UniswapV3) {
        amountOut += uniswapV3SwapExactInput(dex, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.ApeSwap) {
        amountOut += apeSwapExactInput(dex, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.Balancer) {
        amountOut += balancerSwapExactInput(dex, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.KyberSwap) {
        amountOut += kyberSwapExactInput(dex, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.QuickSwap) {
        amountOut += quickSwapExactInput(dex, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.SushiSwap) {
        amountOut += sushiSwapExactInput(dex, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.Woofi) {
        amountOut += wooFiSwapExactInput(dex, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.TraderJoe) {
        amountOut += traderJoeSwapExactInput(dex, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.Camelot) {
        amountOut += camelotSwapExactInput(dex, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else {
        revert UnknownDex();
      }
    }

  }

  function swapExactOutput(
    uint256 swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) external returns (uint256 amountIn) {
    require(amountOut != 0, 'zero amount');

    (SwapsDecoder.SwapInfo[] memory swapInfos, uint256 swapsNumber) = SwapsDecoder.decodeSwapInfo(swapCalldata);

    for(uint256 i; i < swapsNumber; ++i){
      Dex dex = swapInfos[i].dex;
      uint256 dexMaxAmountIn = Math.mulDiv(maxAmountIn, swapInfos[i].swapRatio, SwapsDecoder.ONE);
      uint256 dexAmountOut = Math.mulDiv(amountOut, swapInfos[i].swapRatio, SwapsDecoder.ONE);

      if (dex == Dex.UniswapV3) {
        amountIn += uniswapV3SwapExactOutput(dex, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.ApeSwap) {
        amountIn += apeSwapExactOutput(dex, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.Balancer) {
        amountIn += balancerSwapExactOutput(dex, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.KyberSwap) {
        amountIn += kyberSwapExactOutput(dex, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.QuickSwap) {
        amountIn += quickSwapExactOutput(dex, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.SushiSwap) {
        amountIn += sushiSwapExactOutput(dex, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.Woofi) {
        amountIn += wooFiSwapExactOutput(dex, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.TraderJoe) {
        amountIn += traderJoeSwapExactOutput(dex, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.Camelot) {
        amountIn += camelotSwapExactOutput(dex, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else {
        revert UnknownDex();
      }
    }
  }
}
