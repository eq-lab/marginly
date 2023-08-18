// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';

import '../Dex.sol';
import '../UniswapV2LikeSwap.sol';

abstract contract KyberClassicSwap is UniswapV2LikeSwap {
  using LowGasSafeMath for uint256;

  uint256 constant PRECISION = 1e18;

  function kyberClassicSwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    address pool = dexPoolMapping[dex][tokenIn][tokenOut];
    amountOut = kyberClassicSwapGetAmountOut(pool, amountIn, tokenIn, tokenOut);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }

  function kyberClassicSwapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    address pool = dexPoolMapping[dex][tokenIn][tokenOut];
    amountIn = kyberClassicSwapGetAmountIn(pool, amountOut, tokenIn, tokenOut);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }

  function kyberClassicSwapGetAmountOut(
    address pool,
    uint256 amountIn,
    address tokenIn,
    address tokenOut
  ) internal view returns (uint256 amountOut) {
    (, , uint256 vReserve0, uint256 vReserve1, uint256 fee) = IKC(pool).getTradeInfo();
    (uint256 vReserveIn, uint256 vReserveOut) = tokenIn < tokenOut ? (vReserve0, vReserve1) : (vReserve1, vReserve0);
    uint256 amountInWithFee = amountIn.mul(PRECISION.sub(fee)) / PRECISION;
    uint256 numerator = amountInWithFee.mul(vReserveOut);
    uint256 denominator = vReserveIn.add(amountInWithFee);
    amountOut = numerator / denominator;
  }

  function kyberClassicSwapGetAmountIn(
    address pool,
    uint256 amountOut,
    address tokenIn,
    address tokenOut
  ) internal view returns (uint256 amountIn) {
    (, , uint256 vReserve0, uint256 vReserve1, uint256 fee) = IKC(pool).getTradeInfo();
    (uint256 vReserveIn, uint256 vReserveOut) = tokenIn < tokenOut ? (vReserve0, vReserve1) : (vReserve1, vReserve0);
    uint256 numerator = vReserveIn.mul(amountOut);
    uint256 denominator = vReserveOut.sub(amountOut);
    amountIn = (numerator / denominator).add(1);
    numerator = amountIn.mul(PRECISION);
    denominator = PRECISION.sub(fee);
    amountIn = numerator.add(denominator - 1) / denominator;
  }
}

interface IKC {
  function getTradeInfo() external view returns (uint256, uint256, uint256, uint256, uint256);
}
