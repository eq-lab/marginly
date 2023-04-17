// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

/// @dev Accrue interest doesn't happen in emergency mode.
/// @notice System mode. By default Regular, otherwise ShortEmergency/LongEmergency
enum Mode {
  Regular,
  /// Recovery mode. Position liquidation occurs earlier when position leverage greater or equal than params.recoveryMaxLeverage.
  /// Position opening is prohibited. Max leverage lower than in the Regular mode
  Recovery,
  /// Short positions collateral does not cover debt. All short positions get liquidated
  /// Long and lend positions should use emergencyWithdraw() to get back their tokens
  ShortEmergency,
  /// Long positions collateral does not enough to cover debt. All long positions get liquidated
  /// Short and lend positions should use emergencyWithdraw() to get back their tokens
  LongEmergency
}
