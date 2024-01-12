// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '../interfaces/IPriceOracle.sol';
import '../libraries/FP96.sol';

contract MockPriceOracle is IPriceOracle {
  uint256 public balancePrice = FP96.one().inner;
  uint256 public marginCallPrice = FP96.one().inner;

  function setBalancePrice(uint256 price) external {
    balancePrice = price;
  }

  function setMarginCallPrice(uint256 price) external {
    marginCallPrice = price;
  }

  function validateOptions(address, address, bytes calldata) external pure {}

  function ensureCanChangeOptions(bytes calldata, bytes calldata) external pure {}

  function getBalancePrice(address, address, bytes calldata) external view returns (uint256) {
    return balancePrice;
  }

  /// @notice Returns marcin call price as FP96 value
  function getMargincallPrice(address, address, bytes calldata) external view returns (uint256) {
    return marginCallPrice;
  }
}
