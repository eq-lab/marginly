// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

import './CompositeOracle.sol';

contract ChainlinkOracle is IPriceOracle, CompositeOracle, Ownable2Step, Pausable {
  struct OracleParams {
    AggregatorV3Interface dataFeed;
  }

  mapping(address => mapping(address => OracleParams)) public getParams;

  /// @notice Set up oracle for pair of tokens
  /// @param quoteToken - address of quote token, address(0) if token is not erc-20 (e.g. USD)
  /// @param baseToken - address of base token, address(0) if token is not erc-20 (e.g. USD)
  /// @param dataFeed - address of chainlink data feed
  function setPair(address quoteToken, address baseToken, address dataFeed) external onlyOwner {
    _setCommonPair(quoteToken, baseToken);

    getParams[quoteToken][baseToken] = OracleParams({dataFeed: AggregatorV3Interface(dataFeed)});
    getParams[baseToken][quoteToken] = OracleParams({dataFeed: AggregatorV3Interface(dataFeed)});
  }

  /// @notice Set up oracle for composition quoteToken/intermediateToken and baseToken/intermediateToken to get the final price baseToken/quoteToken
  /// @param quoteToken - should be address of erc-20 token
  /// @param intermediateToken - address of erc-20 token or address(0)
  /// @param baseToken - should be address of erc-20 token
  /// @dev quoteToken / intermediateToken and baseToken / intermediateToken should be configured before calling this function
  function setCompositePair(address quoteToken, address intermediateToken, address baseToken) external onlyOwner {
    _setCompositePair(quoteToken, intermediateToken, baseToken);
  }

  function getBalancePrice(address quoteToken, address baseToken) external view whenNotPaused returns (uint256) {
    return _getPrice(quoteToken, baseToken);
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view whenNotPaused returns (uint256) {
    return _getPrice(quoteToken, baseToken);
  }

  function getRationalPrice(address quoteToken, address baseToken) internal view override returns (uint256, uint256) {
    OracleParams memory params = getParams[quoteToken][baseToken];

    (
      ,
      /* uint80 roundID */ int answer /* uint startedAt */ /* uint timeStamp */ /* uint80 answeredInRound */,
      ,
      ,

    ) = params.dataFeed.latestRoundData();
    if (answer < 0) revert InvalidPrice();

    uint8 decimals = params.dataFeed.decimals();

    return (uint256(answer), 10 ** decimals);
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }
}
