// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

interface IMarginlyPoolWrapper {
  /// @dev wrapped Marginly depositBase and long calls. Works for creating new positions only
  function long(address marginlyPoolAddress, uint256 depositBaseAmount, uint256 longBaseAmount) external;

  /// @dev wrapped Marginly depositQuote and short calls. Works for creating new positions only
  function short(address marginlyPoolAddress, uint256 depositQuoteAmount, uint256 shortBaseAmount) external;
}
