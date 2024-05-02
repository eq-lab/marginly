// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

import './CompositeOracle.sol';

contract ChainlinkOracle is IPriceOracle, CompositeOracle, Ownable2Step, Pausable {
  error WrongValue();
  error StalePrice();
  error SequencerIsDown();
  error SequencerGracePeriodNotOver();

  /// @dev address(0) means that sequncer feed is not provided and should not be checked for up and grace period
  address public immutable sequencerFeed;

  /// @dev zero value means that there is no grace period since sequncer is up
  uint256 public sequencerGracePeriod = 900; // 15 minutes by default

  /// @dev Sequencer feed should be provided for L2 chains, use address(0) for L1 chains
  constructor(address _sequencerFeed) {
    sequencerFeed = _sequencerFeed;
  }

  struct OracleParams {
    AggregatorV3Interface dataFeed;
    uint32 maxPriceAge;
  }

  mapping(address => mapping(address => OracleParams)) public getParams;

  /// @notice Set up oracle for pair of tokens
  /// @param quoteToken - address of quote token, address(0) if token is not erc-20 (e.g. USD)
  /// @param baseToken - address of base token, address(0) if token is not erc-20 (e.g. USD)
  /// @param dataFeed - address of chainlink data feed
  /// @param maxPriceAge - max age of price, if price is older than max age, price is stale and cannot be used
  function setPair(address quoteToken, address baseToken, address dataFeed, uint32 maxPriceAge) external onlyOwner {
    if (maxPriceAge == 0) revert WrongValue();

    _setCommonPair(quoteToken, baseToken);

    getParams[quoteToken][baseToken] = OracleParams({
      dataFeed: AggregatorV3Interface(dataFeed),
      maxPriceAge: maxPriceAge
    });
    getParams[baseToken][quoteToken] = OracleParams({
      dataFeed: AggregatorV3Interface(dataFeed),
      maxPriceAge: maxPriceAge
    });
  }

  /// @notice Set up oracle for composition quoteToken/intermediateToken and baseToken/intermediateToken to get the final price baseToken/quoteToken
  /// @param quoteToken - should be address of erc-20 token
  /// @param intermediateToken - address of erc-20 token or address(0)
  /// @param baseToken - should be address of erc-20 token
  /// @dev quoteToken / intermediateToken and baseToken / intermediateToken should be configured before calling this function
  function setCompositePair(address quoteToken, address intermediateToken, address baseToken) external onlyOwner {
    _setCompositePair(quoteToken, intermediateToken, baseToken);
  }

  function updateSequencerGracePeriod(uint256 _sequencerGracePeriod) external onlyOwner {
    sequencerGracePeriod = _sequencerGracePeriod;
  }

  function getBalancePrice(address quoteToken, address baseToken) external view whenNotPaused returns (uint256) {
    return _getPrice(quoteToken, baseToken);
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view whenNotPaused returns (uint256) {
    return _getPrice(quoteToken, baseToken);
  }

  function getRationalPrice(address quoteToken, address baseToken) internal view override returns (uint256, uint256) {
    if (sequencerFeed != address(0)) {
      (, int sequencerAnswer, uint256 sequencerStartedAt, , ) = AggregatorV3Interface(sequencerFeed).latestRoundData();

      // sequencerAnswer == 0: Sequencer is up
      // sequencerAnswer == 1: Sequencer is down
      if (sequencerAnswer != 0) revert SequencerIsDown();

      // Make sure the grace period has passed after the
      // sequencer is back up.
      uint256 timeSinceUp = block.timestamp - sequencerStartedAt;
      if (timeSinceUp < sequencerGracePeriod) revert SequencerGracePeriodNotOver();
    }

    OracleParams memory params = getParams[quoteToken][baseToken];

    (, int answer, , uint updatedAt, ) = params.dataFeed.latestRoundData();
    if (updatedAt < (block.timestamp - params.maxPriceAge)) revert StalePrice();
    if (answer <= 0) revert InvalidPrice();

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
