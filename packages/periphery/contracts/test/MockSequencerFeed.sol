// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';

contract MockSequencerFeed {
  int256 private answer;

  function setAnswer(int256 _answer) external {
    answer = _answer;
  }

  function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
    return (0, answer, 0, 0, 0);
  }
}
