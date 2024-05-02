// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface IPriceOracle {
  /// @notice Returns price as X96 value
  function getBalancePrice(address quoteToken, address baseToken) external view returns (uint256);

  /// @notice Returns margin call price as X96 value
  function getMargincallPrice(address quoteToken, address baseToken) external view returns (uint256);
}
