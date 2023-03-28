// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

/// @dev Accrue interese doesn't happen in emergency mode.
/// @notice System mode. By default Regular, otherwise ShortEmergency/LongEmergency
enum Mode {
  Regular,
  /// Recovery mode. Position liquidation occurs earlier when position leverage greater or eqaul than params.recoveryMaxLeverage.
  /// Position opening is prohibited. Max leverage lower than in the Regular mode
  Recovery,
  /// Short positions collateral not cover debt. All short positions liquidated
  /// Long and lend positions should use emergencyWithdraw() to get back their tokens
  ShortEmergency,
  /// Long positions collateral not enough to cover debt. All long positions liquidated
  /// Short and lend positions should use emergencyWithdraw() to get back their tokens
  LongEmergency
}
