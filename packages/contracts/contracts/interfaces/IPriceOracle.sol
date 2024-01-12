// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface IPriceOracle {
  /// @notice Initialize oracle for address
  function initialize(address caller, bytes calldata options) external;

  /// @notice Returns price as FP96 value
  function getBalancePrice(address caller) external view returns (uint256);

  /// @notice Returns margin call price as FP96 value
  function getMargincallPrice(address caller) external view returns (uint256);
}
