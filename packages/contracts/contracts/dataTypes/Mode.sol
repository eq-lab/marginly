// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

/// @dev Accrue interest doesn't happen in emergency mode.
/// @notice System mode. By default Regular, otherwise ShortEmergency/LongEmergency
enum Mode {
  Regular,
  /// Short positions collateral does not cover debt. All short positions get liquidated
  /// Long and lend positions should use emergencyWithdraw() to get back their tokens
  ShortEmergency,
  /// Long positions collateral does not enough to cover debt. All long positions get liquidated
  /// Short and lend positions should use emergencyWithdraw() to get back their tokens
  LongEmergency
}
