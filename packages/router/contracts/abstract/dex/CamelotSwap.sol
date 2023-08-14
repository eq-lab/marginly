// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';

import '../Dex.sol';
import '../UniswapV2LikeSwap.sol';

abstract contract CamelotSwap is UniswapV2LikeSwap {
  using LowGasSafeMath for uint256;

  function camelotSwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    address pool = dexPoolMapping[dex][tokenIn][tokenOut];
    amountOut = camelotSwapGetAmountOut(pool, amountIn, tokenIn, tokenOut);
    require(amountOut >= minAmountOut, 'Insufficient amount');
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }

  function camelotSwapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    address pool = dexPoolMapping[dex][tokenIn][tokenOut];
    amountIn = camelotSwapGetAmountIn(pool, amountOut, tokenIn, tokenOut);
    require(amountIn <= maxAmountIn, 'Too much requested');
    uniswapV2LikeSwap(pool, tokenIn, tokenOut, amountIn, amountOut);
  }

  function camelotSwapGetAmountOut(
    address pool,
    uint amountIn,
    address tokenIn,
    address tokenOut
  ) internal view returns (uint amountOut) {
    (uint reserveIn, uint reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint16 fee = tokenIn < tokenOut ? ICamelotPair(pool).token0FeePercent() : ICamelotPair(pool).token1FeePercent();
    uint amountInWithFee = amountIn.mul(fee);
    uint numerator = amountInWithFee.mul(reserveOut);
    uint denominator = reserveIn.mul(100000).add(amountInWithFee);
    amountOut = numerator / denominator;
  }

  function camelotSwapGetAmountIn(
    address pool,
    uint amountOut,
    address tokenIn,
    address tokenOut
  ) internal view returns (uint amountIn) {
    (uint reserveIn, uint reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint numerator = reserveIn.mul(amountOut).mul(100000);
    uint16 fee = tokenIn < tokenOut ? ICamelotPair(pool).token0FeePercent() : ICamelotPair(pool).token1FeePercent();
    uint denominator = reserveOut.sub(amountOut).mul(fee);
    amountIn = (numerator / denominator).add(1);
  }
}

interface ICamelotPair {
  function token0FeePercent() external view returns (uint16);

  function token1FeePercent() external view returns (uint16);
}
