// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol';

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

/// @notice ExampleSlidingWindowOracle with a little modifications https://github.com/Uniswap/v2-periphery/blob/master/contracts/examples/ExampleSlidingWindowOracle.sol
contract UniswapV2Oracle is IPriceOracle, Ownable2Step {
  uint256 private constant X96ONE = 79228162514264337593543950336;

  error WrongValue();
  error WrongGranularity();
  error WrongWindow();
  error PairNotFound();
  error MissingHistoricalObservation();
  error UnexpectedTimeElapsed();
  error PairAlreadyExists();

  struct TokenPair {
    address quoteToken;
    address baseToken;
  }

  struct Observation {
    uint timestamp;
    uint priceCumulative;
  }

  struct PairOracleOptions {
    uint16 secondsAgo;
    uint16 secondsAgoLiquidation;
  }

  address public immutable factory;
  // the desired amount of time over which the moving average should be computed, e.g. 24 hours
  uint public immutable windowSize;
  // the number of observations stored for each pair, i.e. how many price observations are stored for the window.
  // as granularity increases from 1, more frequent updates are needed, but moving averages become more precise.
  // averages are computed over intervals with sizes in the range:
  //   [windowSize - (windowSize / granularity) * 2, windowSize]
  // e.g. if the window size is 24 hours, and the granularity is 24, the oracle will return the average price for
  //   the period:
  //   [now - [22 hours, 24 hours], now]
  uint8 public immutable granularity;
  // this is redundant with granularity and windowSize, but stored for gas savings & informational purposes.
  uint public immutable periodSize;

  // pair address converted into number,
  // when pairKey > 0 means pair.token0 - is base token and pair.token1 - is quote token
  int256[] public pairKeys;

  // mapping from pairKey to a list of price observations of that pair
  mapping(int256 => Observation[]) public pairObservations;
  // mapping from pairKey to options for that pair
  mapping(int256 => PairOracleOptions) public pairOptions;

  constructor(address factory_, uint windowSize_, uint8 granularity_) {
    if (factory_ == address(0)) revert WrongValue();
    if (granularity_ < 2) revert WrongGranularity();
    if ((periodSize = windowSize_ / granularity_) * granularity_ != windowSize_) revert WrongWindow();

    factory = factory_;
    windowSize = windowSize_;
    granularity = granularity_;
  }

  ///@notice Absolute value
  function _abs(int256 x) private pure returns (int) {
    return x >= 0 ? x : -x;
  }

  ///@notice Convert an address to an int256
  function _addressToNumber(address addr) private pure returns (int256) {
    return int256(uint256(uint160(addr)));
  }

  ///@notice Returns the address of the pair corresponding to the given pairKey
  function keyToAddress(int256 key) public pure returns (address) {
    return address(uint160(uint256(_abs(key))));
  }

  ///@notice Returns the index of the observation corresponding to the given timestamp
  function observationIndexOf(uint timestamp) public view returns (uint8 index) {
    uint epochPeriod = timestamp / periodSize;
    return uint8(epochPeriod % granularity);
  }

  ///@notice update the cumulative price for the observation at the current timestamp. each observation is updated at most once per epoch period
  function update(int256 pairKey) public {
    // get the observation for the current period
    uint8 observationIndex = observationIndexOf(block.timestamp);
    Observation storage observation = pairObservations[pairKey][observationIndex];

    // we only want to commit updates once per period (i.e. windowSize / granularity)
    uint timeElapsed = block.timestamp - observation.timestamp;
    if (timeElapsed > periodSize) {
      address pair = keyToAddress(pairKey);
      (uint price0Cumulative, uint256 price1Cumulative, ) = UniswapV2OracleLibrary.currentCumulativePrices(pair);
      observation.timestamp = block.timestamp;
      observation.priceCumulative = pairKey > 0 ? price0Cumulative : price1Cumulative;
    }
  }

  /// @notice Update all pairs in the oracle
  function updateAll() external {
    uint256 length = pairKeys.length;
    for (uint i; i < length; ) {
      update(pairKeys[i]);

      unchecked {
        i++;
      }
    }
  }

  /// @notice Add new pairs to the oracle
  function addPairs(TokenPair[] calldata tokenPairs, PairOracleOptions[] calldata newOptions) external onlyOwner {
    uint256 length = tokenPairs.length;
    if (length != newOptions.length) revert WrongValue();

    uint256 _granularity = granularity;
    address _factory = factory;
    uint256 _windowSize = windowSize;
    for (uint i; i < length; ) {
      PairOracleOptions memory options = newOptions[i];
      if (options.secondsAgo < _granularity || options.secondsAgoLiquidation < _granularity) revert WrongValue();
      if (options.secondsAgo > _windowSize || options.secondsAgoLiquidation > _windowSize) revert WrongValue();

      TokenPair memory tokenPair = tokenPairs[i];
      address pair = IUniswapV2Factory(_factory).getPair(tokenPair.quoteToken, tokenPair.baseToken);
      if (pair == address(0)) revert PairNotFound();

      int256 pairKey = tokenPair.baseToken < tokenPair.quoteToken ? _addressToNumber(pair) : -_addressToNumber(pair);

      if (pairOptions[pairKey].secondsAgo != 0) revert PairAlreadyExists();

      pairKeys.push(pairKey);
      pairOptions[pairKey] = options;

      // populate the array with empty observations (first call only)
      for (uint j; j < _granularity; ) {
        pairObservations[pairKey].push();

        unchecked {
          j++;
        }
      }

      unchecked {
        ++i;
      }
    }
  }

  /// @notice Remove a pair from the oracle
  function removePairAt(uint256 index) external onlyOwner {
    uint256 lastIndex = pairKeys.length - 1;
    int256 pairKey = pairKeys[index];
    delete pairOptions[pairKey];
    delete pairObservations[pairKey];

    if (lastIndex != 0 && lastIndex != index) {
      pairKeys[index] = pairKeys[lastIndex];
    }

    pairKeys.pop();
  }

  /// @notice Returns the price in Q96 format of the given pair in the last `secondsAgo` seconds
  function computePrice(int256 pairKey, uint16 secondsAgo) public view returns (uint256) {
    uint256 observationIndex = observationIndexOf(block.timestamp - secondsAgo);
    Observation memory observationStart = pairObservations[pairKey][observationIndex];

    uint timeElapsed = block.timestamp - observationStart.timestamp;
    if (timeElapsed > windowSize) revert MissingHistoricalObservation();
    // should never happen.
    if (timeElapsed < granularity) revert UnexpectedTimeElapsed();
    address pair = keyToAddress(pairKey);
    (uint256 price0CumulativeEnd, uint256 price1CumulativeEnd, ) = UniswapV2OracleLibrary.currentCumulativePrices(pair);
    uint256 priceCumulativeEnd = pairKey > 0 ? price0CumulativeEnd : price1CumulativeEnd;
    // ">>16" converting from q112 to q96 FP
    return uint256((priceCumulativeEnd - observationStart.priceCumulative) / timeElapsed) >> 16;
  }

  function getBalancePrice(address quoteToken, address baseToken) external view returns (uint256 price) {
    address pair = IUniswapV2Factory(factory).getPair(quoteToken, baseToken);
    int256 pairKey = baseToken < quoteToken ? _addressToNumber(pair) : -_addressToNumber(pair);

    price = computePrice(pairKey, pairOptions[pairKey].secondsAgo);
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view returns (uint256 price) {
    address pair = IUniswapV2Factory(factory).getPair(quoteToken, baseToken);
    int256 pairKey = baseToken < quoteToken ? _addressToNumber(pair) : -_addressToNumber(pair);

    price = computePrice(pairKey, pairOptions[pairKey].secondsAgoLiquidation);
  }
}
