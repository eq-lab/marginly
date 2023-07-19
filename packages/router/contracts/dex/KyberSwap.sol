// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';

import './dex.sol';
import './UniswapV2Swap.sol';

abstract contract KyberSwap is UniswapV2Swap {
  using LowGasSafeMath for uint256;

  function kyberSwapGetAmountOut(
    address pool,
    uint amountIn,
    address tokenIn,
    address tokenOut
  ) internal view returns (uint amountOut) {
    (uint reserve0, uint reserve1, , , uint fee) = IKC(pool).getTradeInfo();
    (uint reserveIn, uint reserveOut) = tokenIn < tokenOut ? (reserve0, reserve1) : (reserve1, reserve0);
    uint amountInWithFee = amountIn.mul(fee);
    uint numerator = amountInWithFee.mul(reserveOut);
    uint denominator = reserveIn.mul(1e18).add(amountInWithFee);
    amountOut = numerator / denominator;
  }

  function kyberSwapGetAmountIn(
    address pool,
    uint amountOut,
    address tokenIn,
    address tokenOut
  ) internal view returns (uint amountIn) {
    (uint reserve0, uint reserve1, , , uint fee) = IKC(pool).getTradeInfo();
    (uint reserveIn, uint reserveOut) = tokenIn < tokenOut ? (reserve0, reserve1) : (reserve1, reserve0);
    uint numerator = reserveIn.mul(amountOut).mul(1e18);
    uint denominator = reserveOut.sub(amountOut).mul(fee);
    amountIn = (numerator / denominator).add(1);
  }
}

interface IKC {
  function getTradeInfo() external view returns (uint256, uint256, uint256, uint256, uint256);
}
