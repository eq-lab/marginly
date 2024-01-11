// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface IMarginlyOracle {
  function initialize() external;

  function getBasePriceX96(
    address baseToken,
    address quoteToken,
    bytes calldata oracleCalldata
  ) external returns (uint256);

  function getLiquidationPriceX96(
    address baseToken,
    address quoteToken,
    bytes calldata oracleCalldata
  ) external returns (uint256);
}
