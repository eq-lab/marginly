// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';

import './dex.sol';

struct UniswapSwapV2CallbackData {
  Dex dex;
  address tokenIn;
  address tokenOut;
}

abstract contract UniswapV2Swap is DexPoolMapping {
  using LowGasSafeMath for uint256;

  function uniswapV2SwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    PoolInfo memory poolInfo = dexPoolMapping[dex][tokenIn][tokenOut];
    amountOut = getAmountOut(poolInfo, amountIn, tokenIn, tokenOut);
    require(amountOut > minAmountOut, 'Insufficient amount');

    TransferHelper.safeTransferFrom(tokenIn, msg.sender, poolInfo.pool, amountIn);
    (uint256 amount0Out, uint256 amount1Out) = tokenIn < tokenOut ? (uint256(0), amountOut) : (amountOut, uint256(0));
    IUniswapV2Pair(poolInfo.pool).swap(amount0Out, amount1Out, msg.sender, new bytes(0));
  }

  function uniswapV2SwapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    PoolInfo memory poolInfo = dexPoolMapping[dex][tokenIn][tokenOut];
    amountIn = getAmountIn(poolInfo, amountOut, tokenIn, tokenOut);
    require(amountIn <= maxAmountIn, 'Too much requested');
    TransferHelper.safeTransferFrom(tokenIn, msg.sender, poolInfo.pool, amountIn);
    (uint256 amount0Out, uint256 amount1Out) = tokenIn < tokenOut ? (uint256(0), amountOut) : (amountOut, uint256(0));
    IUniswapV2Pair(poolInfo.pool).swap(amount0Out, amount1Out, msg.sender, new bytes(0));
  }

  function getAmountOut(
    PoolInfo memory poolInfo,
    uint amountIn,
    address tokenIn,
    address tokenOut
  ) private view returns (uint amountOut) {
    (uint reserveIn, uint reserveOut) = getReserves(poolInfo.pool, tokenIn, tokenOut);
    uint amountInWithFee = amountIn.mul(poolInfo.fee);
    uint numerator = amountInWithFee.mul(reserveOut);
    uint denominator = reserveIn.mul(1000).add(amountInWithFee);
    amountOut = numerator / denominator;
  }

  function getAmountIn(
    PoolInfo memory poolInfo,
    uint amountOut,
    address tokenIn,
    address tokenOut
  ) private view returns (uint amountIn) {
    (uint reserveIn, uint reserveOut) = getReserves(poolInfo.pool, tokenIn, tokenOut);
    uint numerator = reserveIn.mul(amountOut).mul(1000);
    uint denominator = reserveOut.sub(amountOut).mul(poolInfo.fee);
    amountIn = (numerator / denominator).add(1);
  }

  function getReserves(
    address pool,
    address tokenA,
    address tokenB
  ) private view returns (uint reserveA, uint reserveB) {
    (uint reserve0, uint reserve1, ) = IUniswapV2Pair(pool).getReserves();
    (reserveA, reserveB) = tokenA < tokenB ? (reserve0, reserve1) : (reserve1, reserve0);
    require(reserveA > 0 && reserveB > 0, 'insufficient liquidity');
  }
}
