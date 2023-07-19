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

  function uniswapV2Swap(
    address pool,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOut
  ) internal {
    TransferHelper.safeTransferFrom(tokenIn, msg.sender, pool, amountIn);
    (uint256 amount0Out, uint256 amount1Out) = tokenIn < tokenOut ? (uint256(0), amountOut) : (amountOut, uint256(0));
    IUniswapV2Pair(pool).swap(amount0Out, amount1Out, msg.sender, new bytes(0));
  }

  function getReserves(
    address pool,
    address tokenA,
    address tokenB
  ) internal view returns (uint reserveA, uint reserveB) {
    (uint reserve0, uint reserve1, ) = IUniswapV2Pair(pool).getReserves();
    (reserveA, reserveB) = tokenA < tokenB ? (reserve0, reserve1) : (reserve1, reserve0);
    require(reserveA > 0 && reserveB > 0, 'insufficient liquidity');
  }
}
