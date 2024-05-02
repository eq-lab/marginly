// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';

contract MockSequencerFeed {
  int256 private answer;
  uint256 private startedAt;

  function setAnswer(int256 _answer, uint256 _startedAt) external {
    answer = _answer;
    startedAt = _startedAt;
  }

  function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
    return (0, answer, startedAt, 0, 0);
  }
}
