// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';

abstract contract UniswapV2LikeSwap {
  using LowGasSafeMath for uint256;

  function uniswapV2LikeSwap(
    address recipient,
    address pool,
    address tokenIn,
    address tokenOut,
    uint256 amountOut
  ) internal {
    (uint256 amount0Out, uint256 amount1Out) = tokenIn < tokenOut ? (uint256(0), amountOut) : (amountOut, uint256(0));
    IUniswapV2Pair(pool).swap(amount0Out, amount1Out, recipient, new bytes(0));
  }

  function uniswapV2LikeGetAmountOut(
    address pool,
    uint256 amountIn,
    address tokenIn,
    address tokenOut,
    uint256 fee
  ) internal view returns (uint256 amountOut) {
    (uint256 reserveIn, uint256 reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint256 amountInWithFee = amountIn.mul(fee);
    uint256 numerator = amountInWithFee.mul(reserveOut);
    uint256 denominator = reserveIn.mul(1000).add(amountInWithFee);
    amountOut = numerator / denominator;
  }

  function uniswapV2LikeGetAmountIn(
    address pool,
    uint256 amountOut,
    address tokenIn,
    address tokenOut,
    uint256 fee
  ) internal view returns (uint256 amountIn) {
    (uint256 reserveIn, uint256 reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint256 numerator = reserveIn.mul(amountOut).mul(1000);
    uint256 denominator = reserveOut.sub(amountOut).mul(fee);
    amountIn = (numerator / denominator).add(1);
  }

  function getReserves(
    address pool,
    address tokenA,
    address tokenB
  ) private view returns (uint256 reserveA, uint256 reserveB) {
    (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(pool).getReserves();
    (reserveA, reserveB) = tokenA < tokenB ? (reserve0, reserve1) : (reserve1, reserve0);
    require(reserveA > 0 && reserveB > 0, 'insufficient liquidity');
  }
}
