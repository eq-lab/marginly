// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';

contract MockChainlink is AggregatorV3Interface {
  error NotImplemented();

  uint8 public immutable override decimals;
  uint256 latestPrice;
  uint256 updatedAt;

  constructor(uint8 _decimals) {
    decimals = _decimals;
  }

  function description() public view virtual override returns (string memory) {
    revert NotImplemented();
  }

  function version() external pure returns (uint256) {
    revert NotImplemented();
  }

  function getRoundData(uint80) external pure returns (uint80, int256, uint256, uint256, uint80) {
    revert NotImplemented();
  }

  function latestRoundData()
    external
    view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 _updatedAt, uint80 answeredInRound)
  {
    return (0, int256(latestPrice), 0, updatedAt, 0);
  }

  function setPrice(uint256 price) external {
    latestPrice = price;
  }

  function setUpdatedAt(uint256 _updatedAt) external {
    updatedAt = _updatedAt;
  }
}
