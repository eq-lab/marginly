// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import '../abstract/AdapterStorage.sol';
import '../interfaces/IMarginlyRouter.sol';

contract WooFiAdapter is AdapterStorage {
  constructor(PoolInput[] memory pools) AdapterStorage(pools) {}

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    AdapterCallbackData calldata data
  ) external returns (uint256 amountOut) {
    IWooPoolV2 wooPool = IWooPoolV2(getPoolSafe(tokenIn, tokenOut));

    IMarginlyRouter(msg.sender).adapterCallback(address(wooPool), amountIn, data);
    amountOut = wooPool.swap(tokenIn, tokenOut, amountIn, minAmountOut, recipient, address(0));

    if (amountOut < minAmountOut) revert InsufficientAmount();
  }

  function swapExactOutput(
    address /*recipient*/,
    address /*tokenIn*/,
    address /*tokenOut*/,
    uint256 /*amountIn*/,
    uint256 /*minAmountOut*/,
    AdapterCallbackData calldata /*data*/
  ) external pure returns (uint256 /*amountOut*/) {
    revert NotSupported();
  }
}

interface IWooPoolV2 {
  function swap(
    address fromToken,
    address toToken,
    uint256 fromAmount,
    uint256 minToAmount,
    address to,
    address rebateTo
  ) external returns (uint256 realToAmount);
}
