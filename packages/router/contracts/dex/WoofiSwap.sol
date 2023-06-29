// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './dex.sol';

abstract contract WooFiSwap is DexFactoryList {
  function wooFiSwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    IWooPoolV2 wooPool = IWooPoolV2(dexFactoryList[dex]);

    TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(wooPool), amountIn);
    amountOut = wooPool.swap(tokenIn, tokenOut, amountIn, minAmountOut, msg.sender, address(0));

    require(amountOut > minAmountOut, 'Insufficient amount');
  }

  function wooFiSwapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    IWooPoolV2 wooPool = IWooPoolV2(dexFactoryList[dex]);

    TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(wooPool), maxAmountIn);
    uint256 actualAmountOut = wooPool.swap(tokenIn, tokenOut, maxAmountIn, amountOut, msg.sender, address(0));
    require(actualAmountOut > amountOut, 'Too much requested');
    amountIn = maxAmountIn;
  }
}

interface IWooPoolV2 {
  function query(address fromToken, address toToken, uint256 fromAmount) external view returns (uint256 toAmount);

  function swap(
    address fromToken,
    address toToken,
    uint256 fromAmount,
    uint256 minToAmount,
    address to,
    address rebateTo
  ) external returns (uint256 realToAmount);
}
