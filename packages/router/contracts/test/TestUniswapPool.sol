// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolImmutables.sol';
import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolState.sol';
import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

contract RouterTestUniswapPool {
  address public token0;
  address public token1;
  uint160 public price = 10;

  bool public debug;
  int256 public debug0;
  int256 public debug1;

  constructor(address _token0, address _token1) {
    token0 = _token0;
    token1 = _token1;
  }

  function swap(
    address recipient,
    bool zeroForOne,
    int256 amountSpecified,
    uint160 sqrtPriceLimitX96,
    bytes calldata data
  ) external returns (int256 amount0, int256 amount1) {
    bool exactInput = amountSpecified > 0;
    uint256 amountSpecifiedAbs = uint256(amountSpecified >= 0 ? amountSpecified : - amountSpecified);

    if (exactInput) {
      if (zeroForOne) {
        amount0 = amountSpecified;
        amount1 = - int256(Math.mulDiv(amountSpecifiedAbs, price, 1));
      } else {
        amount1 = amountSpecified;
        amount0 = - int256(Math.mulDiv(amountSpecifiedAbs, 1, price));
      }
    } else {
      if (zeroForOne) {
        amount0 = int256(Math.mulDiv(amountSpecifiedAbs, 1, price));
        amount1 = amountSpecified;
      } else {
        amount1 = int256(Math.mulDiv(amountSpecifiedAbs, price, 1));
        amount0 = amountSpecified;
      }
    }

    debug = zeroForOne;
    debug0 = amount0;
    debug1 = amount1;

    // do the transfers and collect payment
    if (zeroForOne) {
      if (amount1 < 0) TransferHelper.safeTransfer(token1, recipient, uint256(- amount1));
      IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, data);
    } else {
      if (amount0 < 0) TransferHelper.safeTransfer(token0, recipient, uint256(- amount0));
      IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, data);
    }
  }
}
