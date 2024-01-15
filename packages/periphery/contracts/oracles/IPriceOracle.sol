// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface IPriceOracle {
  /// @notice Validate price oracle options for pair of tokens
  function validateOptions(address quoteToken, address baseToken, bytes calldata options) external view;

  /// @notice
  function canChangeOptions(bytes calldata newOptions, bytes calldata oldOptions) external view returns (bool);

  /// @notice Returns price as X96 value
  function getBalancePrice(
    address quoteToken,
    address baseToken,
    bytes calldata options
  ) external view returns (uint256);

  /// @notice Returns margin call price as X96 value
  function getMargincallPrice(
    address quoteToken,
    address baseToken,
    bytes calldata options
  ) external view returns (uint256);
}
