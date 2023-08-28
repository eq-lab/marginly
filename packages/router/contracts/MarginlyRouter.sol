// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './interfaces/IMarginlyRouter.sol';
import './libraries/SwapsDecoder.sol';

import './abstract/Dex.sol';
import './abstract/dex/UniswapV3Swap.sol';
import './abstract/dex/ApeSwap.sol';
import './abstract/dex/BalancerSwap.sol';
import './abstract/dex/CamelotSwap.sol';
import './abstract/dex/KyberClassicSwap.sol';
import './abstract/dex/KyberElasticSwap.sol';
import './abstract/dex/SushiSwap.sol';
import './abstract/dex/QuickSwap.sol';
import './abstract/dex/TraderJoeSwap.sol';
import './abstract/dex/WoofiSwap.sol';

contract MarginlyRouter is
  IMarginlyRouter,
  Ownable,
  UniswapV3Swap,
  ApeSwap,
  BalancerSwap,
  CamelotSwap,
  KyberClassicSwap,
  KyberElasticSwap,
  QuickSwap,
  SushiSwap,
  TraderJoeSwap,
  WooFiSwap
{
  constructor(PoolInput[] memory pools, address balancerVault) DexPoolMapping(pools) BalancerSwap(balancerVault) {}

  /// @inheritdoc IMarginlyRouter
  function swapExactInput(
    uint256 swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256 amountOut) {
    require(amountIn != 0, 'zero amount');

    (SwapsDecoder.SwapInfo[] memory swapInfos, uint256 swapsNumber) = SwapsDecoder.decodeSwapInfo(swapCalldata);

    for (uint256 i; i < swapsNumber; ++i) {
      uint256 dexIndex = swapInfos[i].dexIndex;
      (address pool, Dex dex) = getPoolSafe(dexIndex, tokenIn, tokenOut);
      uint256 dexAmountIn = Math.mulDiv(amountIn, swapInfos[i].swapRatio, SwapsDecoder.ONE);
      uint256 dexMinAmountOut = Math.mulDiv(minAmountOut, swapInfos[i].swapRatio, SwapsDecoder.ONE);

      uint256 dexAmountOut;
      if (dex == Dex.UniswapV3) {
        dexAmountOut = uniswapV3SwapExactInput(dexIndex, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.ApeSwap) {
        dexAmountOut = apeSwapExactInput(pool, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.Balancer) {
        dexAmountOut = balancerSwapExactInput(pool, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.KyberClassicSwap) {
        dexAmountOut = kyberClassicSwapExactInput(pool, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.KyberElasticSwap) {
        dexAmountOut = kyberElasticSwapExactInput(dexIndex, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.QuickSwap) {
        dexAmountOut = quickSwapExactInput(pool, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.SushiSwap) {
        dexAmountOut = sushiSwapExactInput(pool, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.Woofi) {
        dexAmountOut = wooFiSwapExactInput(pool, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.TraderJoe) {
        dexAmountOut = traderJoeSwapExactInput(pool, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else if (dex == Dex.Camelot) {
        dexAmountOut = camelotSwapExactInput(pool, tokenIn, tokenOut, dexAmountIn, dexMinAmountOut);
      } else {
        revert UnknownDex();
      }
      amountOut += dexAmountOut;
      emit Swap(true, dex, msg.sender, tokenIn, tokenOut, dexAmountIn, dexAmountOut);
    }
  }

  /// @inheritdoc IMarginlyRouter
  function swapExactOutput(
    uint256 swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) external returns (uint256 amountIn) {
    require(amountOut != 0, 'zero amount');

    (SwapsDecoder.SwapInfo[] memory swapInfos, uint256 swapsNumber) = SwapsDecoder.decodeSwapInfo(swapCalldata);

    for (uint256 i; i < swapsNumber; ++i) {
      uint256 dexIndex = swapInfos[i].dexIndex;
      (address pool, Dex dex) = getPoolSafe(dexIndex, tokenIn, tokenOut);
      uint256 dexMaxAmountIn = Math.mulDiv(maxAmountIn, swapInfos[i].swapRatio, SwapsDecoder.ONE);
      uint256 dexAmountOut = Math.mulDiv(amountOut, swapInfos[i].swapRatio, SwapsDecoder.ONE);

      uint256 dexAmountIn;
      if (dex == Dex.UniswapV3) {
        dexAmountIn = uniswapV3SwapExactOutput(dexIndex, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.ApeSwap) {
        dexAmountIn = apeSwapExactOutput(pool, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.Balancer) {
        dexAmountIn = balancerSwapExactOutput(pool, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.KyberClassicSwap) {
        dexAmountIn = kyberClassicSwapExactOutput(pool, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.KyberElasticSwap) {
        dexAmountIn = kyberElasticSwapExactOutput(dexIndex, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.QuickSwap) {
        dexAmountIn = quickSwapExactOutput(pool, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.SushiSwap) {
        dexAmountIn = sushiSwapExactOutput(pool, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.Woofi) {
        // woofi pools don't support exactOutput swaps
        revert NotSupported();
      } else if (dex == Dex.TraderJoe) {
        dexAmountIn = traderJoeSwapExactOutput(pool, tokenIn, tokenOut, dexMaxAmountIn, dexAmountOut);
      } else if (dex == Dex.Camelot) {
        // camelot pools don't support exactOutput swaps
        revert NotSupported();
      } else {
        revert UnknownDex();
      }

      amountIn += dexAmountIn;
      emit Swap(false, dex, msg.sender, tokenIn, tokenOut, dexAmountIn, dexAmountOut);
    }
  }
}
