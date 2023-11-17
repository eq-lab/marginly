// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';

contract ChainlinkAggregatorV3Mock is AggregatorV3Interface {
  uint8 public override decimals;
  uint256 constant public override version = 4;
  int256 _answer;

  constructor(int256 answer, uint8 _decimals) {
    _answer = answer;
    decimals = _decimals;
  }

  function description()
    public
    override
    view
    virtual
    returns (string memory)
  {
    return "Test Aggregator";
  }

  function getRoundData(uint80 _roundId)
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {

    }

  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {
      return (
        0, _answer, 0, 0, 0
      );
    }
}