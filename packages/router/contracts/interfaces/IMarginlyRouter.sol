// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../abstract/Dex.sol';

interface IMarginlyRouter {
  /// @notice Emitted when swap happened
  /// @param isExactInput true if swapExactInput, false if swapExactOutput
  /// @param dex dex used for swap
  /// @param receiver swap result receiver
  /// @param tokenIn address of a token swapped on dex
  /// @param tokenOut address of a token received from dex
  /// @param amountIn amount of tokenIn swapped
  /// @param amountOut amount of tokenOut received
  event Swap(
    bool isExactInput, 
    Dex dex, 
    address indexed receiver, 
    address indexed tokenIn, 
    address indexed tokenOut, 
    uint256 amountIn, 
    uint256 amountOut
  );

  /// @notice swap with exact input
  /// @param swapCalldata calldata for multiple swaps
  /// @param tokenIn address of a token to swap on dex
  /// @param tokenOut address of a token to receive from dex
  /// @param amountIn exact amount of tokenIn to swap
  /// @param minAmountOut minimal amount of tokenOut to receive
  function swapExactInput(
    uint256 swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256);

  /// @notice swap with exact output
  /// @param swapCalldata calldata for multiple swaps
  /// @param tokenIn address of a token to swap on dex
  /// @param tokenOut address of a token to receive from dex
  /// @param maxAmountIn maximal amount of tokenIn to swap
  /// @param amountOut exact amount of tokenOut to receive
  function swapExactOutput(
    uint256 swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) external returns (uint256);
}
