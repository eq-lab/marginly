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
  /// @dev Type of a given position
  PositionType _type;
  /// @dev Position in heap equals indexOfHeap + 1. Zero value means position does not exist in heap
  uint32 heapPosition;
  /// @dev negative value if _type == Short, positive value otherwise in base asset (e.g. WETH)
  uint256 discountedBaseAmount;
  /// @dev negative value if _type == Long, positive value otherwise in quote asset (e.g. USDC)
  uint256 discountedQuoteAmount;
}
