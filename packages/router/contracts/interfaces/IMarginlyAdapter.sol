// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../abstract/AdapterCallback.sol';

interface IMarginlyAdapter {
  error InsufficientAmount();
  error TooMuchRequested();
  error NotSupported();

  /// @notice swap with exact input
  /// @param recipient recipient of amountOut of tokenOut
  /// @param tokenIn address of a token to swap on dex
  /// @param tokenOut address of a token to receive from dex
  /// @param amountIn exact amount of tokenIn to swap
  /// @param minAmountOut minimal amount of tokenOut to receive
  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    AdapterCallbackData calldata data
  ) external returns (uint256 amountOut);

  /// @notice swap with exact output
  /// @param recipient recipient of amountOut of tokenOut
  /// @param tokenIn address of a token to swap on dex
  /// @param tokenOut address of a token to receive from dex
  /// @param maxAmountIn maximal amount of tokenIn to swap
  /// @param amountOut exact amount of tokenOut to receive
  function swapExactOutput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    AdapterCallbackData calldata data
  ) external returns (uint256 amountIn);
}
