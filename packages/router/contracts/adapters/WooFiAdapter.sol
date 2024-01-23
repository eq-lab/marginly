// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

import '../abstract/AdapterStorage.sol';
import '../abstract/UniswapV3LikeSwap.sol';
import '../interfaces/IMarginlyRouter.sol';
import '../libraries/SwapsDecoder.sol';

contract WooFiAdapter is AdapterStorage, UniswapV3LikeSwap {
  uint16 constant EXACT_OUTPUT_SWAP_RATIO = 24576; // 0.75 * SwapsDecoder.ONE
  uint256 constant UNISWAP_V3_ADAPTER_INDEX = 0;

  constructor(PoolInput[] memory pools) AdapterStorage(pools) {}

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) external returns (uint256 amountOut) {
    IWooPoolV2 wooPool = IWooPoolV2(getPoolSafe(tokenIn, tokenOut));

    IMarginlyRouter(msg.sender).adapterCallback(address(wooPool), amountIn, data);
    amountOut = wooPool.swap(tokenIn, tokenOut, amountIn, minAmountOut, recipient, address(0));

    if (amountOut < minAmountOut) revert InsufficientAmount();
  }

  function swapExactOutput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    bytes calldata data
  ) external returns (uint256 amountIn) {
    amountIn += (EXACT_OUTPUT_SWAP_RATIO * maxAmountIn) / SwapsDecoder.ONE;

    IWooPoolV2 wooPool = IWooPoolV2(getPoolSafe(tokenIn, tokenOut));
    IMarginlyRouter(msg.sender).adapterCallback(address(wooPool), amountIn, data);
    uint256 wooFiAmountOut = wooPool.swap(tokenIn, tokenOut, amountIn, 0, recipient, address(0));
    require(wooFiAmountOut < amountOut);

    address uniswapV3 = AdapterStorage(RouterStorage(msg.sender).adapters(UNISWAP_V3_ADAPTER_INDEX)).getPool(
      tokenIn,
      tokenOut
    );
    bool zeroForOne = tokenIn < tokenOut;
    CallbackData memory swapData = CallbackData({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      initiator: msg.sender,
      data: data
    });

    (uint256 uniswapAmountIn, ) = uniswapV3LikeSwap(
      recipient,
      uniswapV3,
      zeroForOne,
      -int256(amountOut - wooFiAmountOut),
      swapData
    );

    amountIn += uniswapAmountIn;
    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external {
    require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
    CallbackData memory data = abi.decode(_data, (CallbackData));
    (address tokenIn, address tokenOut) = (data.tokenIn, data.tokenOut);
    address uniswapV3 = AdapterStorage(RouterStorage(data.initiator).adapters(UNISWAP_V3_ADAPTER_INDEX)).getPool(
      tokenIn,
      tokenOut
    );
    require(msg.sender == uniswapV3);

    (bool isExactInput, uint256 amountToPay) = amount0Delta > 0
      ? (tokenIn < tokenOut, uint256(amount0Delta))
      : (tokenOut < tokenIn, uint256(amount1Delta));

    require(isExactInput);

    IMarginlyRouter(data.initiator).adapterCallback(msg.sender, amountToPay, data.data);
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
