// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import '@openzeppelin/contracts/access/AccessControl.sol';

contract ChainlinkAggregatorV3Mock is AggregatorV3Interface, AccessControl {
  uint256 public override version = 4;
  bytes32 public constant ORACLE_ROLE = keccak256('ORACLE_ROLE');
  uint256 public immutable priceDenominator;
  uint8 public immutable override decimals;
  uint256 latestPrice;

  event SetPrice(uint256 price);

  constructor(address oracle, uint8 _decimals) {
    _setupRole(ORACLE_ROLE, oracle);
    _setupRole(ORACLE_ROLE, msg.sender);
    decimals = _decimals;
    priceDenominator = 10 ** _decimals;
  }

  function description() public view virtual override returns (string memory) {
    return 'Test Aggregator';
  }

  function getRoundData(
    uint80 _roundId
  )
    external
    view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
  {}

  function latestRoundData()
    external
    view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
  {
    return (0, int256(latestPrice), 0, 0, 0);
  }

  modifier onlyOracle() {
    require(hasRole(ORACLE_ROLE, msg.sender), 'Caller is not an oracle');
    _;
  }

  function setPrice(uint256 price, uint160 /*sqrtPriceX96*/) external onlyOracle {
    latestPrice = price;

    emit SetPrice(price);
  }
}
