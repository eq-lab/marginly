// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

struct MarginlyParams {
  /// @dev Maximum allowable leverage in the Regular mode.
  uint8 maxLeverage;
  /// @dev Number of seconds in the past from which to calculate the time-weighted-average-price
  uint16 priceSecondsAgo;
  /// @dev Number of seconds in the past from which to calculate the time-weighted-average-price for swaps in MC
  uint16 priceSecondsAgoMC;
  /// @dev Interest rate. Example 1% = 10000
  uint24 interestRate;
  /// @dev Close debt fee. 1% = 10000
  uint24 fee;
  /// @dev Pool fee. When users take leverage they pay `swapFee` on the notional borrow amount. 1% = 10000
  uint24 swapFee;
  /// @dev Max slippage when margin call
  uint24 mcSlippage;
  /// @dev Min amount of base token to open short/long position
  uint184 positionMinAmount;
  /// @dev Max amount of quote token in system
  uint184 quoteLimit;
}
