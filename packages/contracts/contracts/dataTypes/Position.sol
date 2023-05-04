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
  /// @dev Position in heap equals indexOfHeap + 1. Zero value means position does not exist in heap
  uint32 heapPosition;
  /// @dev Type of a given position
  PositionType _type;
  /// @dev [0] - discountedQuoteAmount, [1] - discountedBaseAmount
  uint256[2] discountedAmount;
}
