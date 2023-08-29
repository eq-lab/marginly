// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';

import '../abstract/AdapterPoolsStorage.sol';
import '../abstract/UniswapV2LikeSwap.sol';
import '../interfaces/IMarginlyAdapter.sol';
import '../interfaces/IMarginlyRouter.sol';

contract KyberClassicSwap is IMarginlyAdapter, AdapterPoolsStorage, UniswapV2LikeSwap {
  using LowGasSafeMath for uint256;

  uint256 private constant PRECISION = 1e18;

  constructor(PoolInput[] memory pools) AdapterPoolsStorage(pools) {}

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    AdapterCallbackData calldata data
  ) external returns (uint256 amountOut) {
    address pool = getPoolSafe(tokenIn, tokenOut);
    amountOut = getAmountOut(pool, amountIn, tokenIn, tokenOut);
    if (amountOut < minAmountOut) revert InsufficientAmount();
    IMarginlyRouter(msg.sender).adapterCallback(pool, amountIn, data);
    uniswapV2LikeSwap(recipient, pool, tokenIn, tokenOut, amountOut);
  }

  function swapExactOutput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    AdapterCallbackData calldata data
  ) external returns (uint256 amountIn) {
    address pool = getPoolSafe(tokenIn, tokenOut);
    amountIn = getAmountIn(pool, amountOut, tokenIn, tokenOut);
    if (amountIn > maxAmountIn) revert TooMuchRequested();
    IMarginlyRouter(msg.sender).adapterCallback(pool, amountIn, data);
    uniswapV2LikeSwap(recipient, pool, tokenIn, tokenOut, amountOut);
  }

  function getAmountOut(
    address pool,
    uint256 amountIn,
    address tokenIn,
    address tokenOut
  ) private view returns (uint256 amountOut) {
    (, , uint256 vReserve0, uint256 vReserve1, uint256 fee) = IKC(pool).getTradeInfo();
    (uint256 vReserveIn, uint256 vReserveOut) = tokenIn < tokenOut ? (vReserve0, vReserve1) : (vReserve1, vReserve0);
    uint256 amountInWithFee = amountIn.mul(PRECISION.sub(fee)) / PRECISION;
    uint256 numerator = amountInWithFee.mul(vReserveOut);
    uint256 denominator = vReserveIn.add(amountInWithFee);
    amountOut = numerator / denominator;
  }

  function getAmountIn(
    address pool,
    uint256 amountOut,
    address tokenIn,
    address tokenOut
  ) private view returns (uint256 amountIn) {
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
