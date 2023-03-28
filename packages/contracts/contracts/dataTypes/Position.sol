// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

enum PositionType {
  Uninitialized,
  Lend,
  Short,
  Long
}

/// @dev User's position in current pool
struct Position {
  /// @dev Position in heap equals indexOfHeap + 1. Zero value means not existed in heap
  uint32 heapPosition;
  /// @dev Type for a given position
  PositionType _type;
  /// @dev negative position if _type == Short, positive position otherwise in base asset (e.g. WETH)
  uint256 discountedBaseAmount;
  /// @dev negative position if _type == Long, positive position otherwise in quote asset (e.g. USDC)
  uint256 discountedQuoteAmount;
}
