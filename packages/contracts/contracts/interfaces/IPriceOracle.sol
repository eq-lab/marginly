// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface IPriceOracle {
  /// @notice Returns price as FP96 value
  function getBalancePrice(bytes calldata arg) external view returns (uint256);

  /// @notice Returns marcin call price as FP96 value
  function getMargincallPrice(bytes calldata arg) external view returns (uint256);
}
