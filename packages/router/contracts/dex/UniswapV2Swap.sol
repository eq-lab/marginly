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

abstract contract UniswapV2Swap is IUniswapV2Callee, DexFactoryList {
  using LowGasSafeMath for uint256;

  function uniswapV2SwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    address poolAddress = getPoolAddress(dex, tokenIn, tokenOut);
    amountOut = getAmountOut(poolAddress, amountIn, tokenIn, tokenOut);
    require(amountOut > minAmountOut, 'Insufficient amount');

    TransferHelper.safeTransferFrom(tokenIn, poolAddress, msg.sender, amountIn);
    (uint256 amount0Out, uint256 amount1Out) = tokenIn < tokenOut ? (uint256(0), amountOut) : (amountOut, uint256(0));
    IUniswapV2Pair(poolAddress).swap(amount0Out, amount1Out, msg.sender, new bytes(0));

    // bool zeroForOne = tokenIn < tokenOut;
    // UniswapSwapV2CallbackData memory data = UniswapSwapV2CallbackData({
    //   dex: dex,
    //   tokenIn: tokenIn,
    //   tokenOut: tokenOut
    // });
    // IUniswapV2Pair(poolAddress).swap(amount0Out, amount1Out, msg.sender, abi.encode(data));
  }

  function uniswapV2SwapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    address poolAddress = getPoolAddress(dex, tokenIn, tokenOut);
    amountIn = getAmountIn(poolAddress, amountIn, tokenIn, tokenOut);
    require(amountIn <= maxAmountIn, 'Insufficient amount');

    TransferHelper.safeTransferFrom(tokenOut, poolAddress, msg.sender, amountIn);
    (uint256 amount0Out, uint256 amount1Out) = tokenIn < tokenOut ? (uint256(0), amountOut) : (amountOut, uint256(0));
    IUniswapV2Pair(poolAddress).swap(amount0Out, amount1Out, msg.sender, new bytes(0));
  }

  // function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata _data) external override {
  //   UniswapSwapV2CallbackData memory data = abi.decode(_data, (UniswapSwapV2CallbackData));
  //   (address token0, address token1) = data.tokenIn < data.tokenOut
  //     ? (data.tokenIn, data.tokenOut)
  //     : (data.tokenOut, data.tokenIn);
  //   require(msg.sender == getPoolAddress(data.dex, token0, token1));

  //   (bool isExactInput, uint256 amountToPay) = amount0 > 0
  //     ? (data.tokenIn < data.tokenOut, uint256(amount0))
  //     : (data.tokenOut < data.tokenIn, uint256(amount1));
  //   if (isExactInput) {
  //     TransferHelper.safeTransferFrom(data.tokenIn, sender, msg.sender, amountToPay);
  //   } else {
  //     TransferHelper.safeTransferFrom(data.tokenOut, sender, msg.sender, amountToPay);
  //   }
  // }

  function getPoolAddress(Dex dex, address tokenA, address tokenB) private view returns (address pool) {
    if (tokenA > tokenB) (tokenA, tokenB) = (tokenB, tokenA);
    pool = IUniswapV2Factory(dexFactoryList[dex]).getPair(tokenA, tokenB);
    if (pool == address(0)) revert UnknownPool();
  }

  function getAmountOut(
    address pool,
    uint amountIn,
    address tokenIn,
    address tokenOut
  ) private view returns (uint amountOut) {
    (uint reserveIn, uint reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint amountInWithFee = amountIn.mul(997);
    uint numerator = amountInWithFee.mul(reserveOut);
    uint denominator = reserveIn.mul(1000).add(amountInWithFee);
    amountOut = numerator / denominator;
  }

  function getAmountIn(
    address pool,
    uint amountOut,
    address tokenIn,
    address tokenOut
  ) private view returns (uint amountIn) {
    (uint reserveIn, uint reserveOut) = getReserves(pool, tokenIn, tokenOut);
    uint numerator = reserveIn.mul(amountOut).mul(1000);
    uint denominator = reserveOut.sub(amountOut).mul(997);
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
