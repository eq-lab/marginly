// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

library FP48 {
  /// @dev Bits precision of FixedPoint number
  uint8 internal constant RESOLUTION = 48;
  /// @dev Denominator for FixedPoint number. 2^48
  uint96 internal constant Q48 = 0x1000000000000;
}
