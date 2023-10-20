// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '../abstract/AdapterStorage.sol';
import '../interfaces/IMarginlyRouter.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';

contract PancakeSwapAdapter is AdapterStorage {
  using LowGasSafeMath for uint256;

  uint256 private constant PANCAKE_SWAP_FEE = 9975;
  constructor(PoolInput[] memory pools) AdapterStorage(pools) {}

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) external returns (uint256 amountOut) {
    address pool = getPoolSafe(tokenIn, tokenOut);
    amountOut = getAmountOut(pool, amountIn, tokenIn, tokenOut, PANCAKE_SWAP_FEE);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    IMarginlyRouter(msg.sender).adapterCallback(pool, amountIn, data);
    swap(recipient, pool, tokenIn, tokenOut, amountOut);
  }

  function swapExactOutput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    bytes calldata data
  ) external returns (uint256 amountIn) {
    address pool = getPoolSafe(tokenIn, tokenOut);
    amountIn = getAmountIn(pool, amountOut, tokenIn, tokenOut, PANCAKE_SWAP_FEE);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
    IMarginlyRouter(msg.sender).adapterCallback(pool, amountIn, data);
    swap(recipient, pool, tokenIn, tokenOut, amountOut);
  }

  function swap(
    address recipient,
    address pool,
    address tokenIn,
    address tokenOut,
    uint256 amountOut
  ) internal {
    (uint256 amount0Out, uint256 amount1Out) = tokenIn < tokenOut ? (uint256(0), amountOut) : (amountOut, uint256(0));
    IUniswapV2Pair(pool).swap(amount0Out, amount1Out, recipient, new bytes(0));
  }

  function getAmountOut(
    address pool,
    uint256 amountIn,
    address tokenIn,
    address tokenOut,
    uint256 fee
  ) internal view returns (uint256 amountOut) {
    (uint256 reserveIn, uint256 reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint256 amountInWithFee = amountIn.mul(fee);
    uint256 numerator = amountInWithFee.mul(reserveOut);
    uint256 denominator = reserveIn.mul(10000).add(amountInWithFee);
    amountOut = numerator / denominator;
  }

  function getAmountIn(
    address pool,
    uint256 amountOut,
    address tokenIn,
    address tokenOut,
    uint256 fee
  ) internal view returns (uint256 amountIn) {
    (uint256 reserveIn, uint256 reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint256 numerator = reserveIn.mul(amountOut).mul(10000);
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
