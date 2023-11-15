// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import './libraries/OracleLib.sol';

contract PriceAdapter {
  AggregatorV3Interface public immutable baseDataFeed;
  AggregatorV3Interface public immutable quoteDataFeed;

  constructor(address _baseDataFeed, address _quoteDataFeed) {
    require(_baseDataFeed != address(0));
    baseDataFeed = AggregatorV3Interface(_baseDataFeed);
    quoteDataFeed = AggregatorV3Interface(_quoteDataFeed);
  }

  function observe(
    uint32[] calldata secondsAgos
  )
    external
    view
    returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
  {
    secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);
    secondsPerLiquidityCumulativeX128s[0] = secondsAgos[0];
    secondsPerLiquidityCumulativeX128s[1] = secondsAgos[1];

    uint160 sqrtPriceX96 = getSqrtPriceX96();
    tickCumulatives = OracleLib.getCumulativeTickAtSqrtRatio(sqrtPriceX96, secondsAgos);
  }

  function getSqrtPriceX96() public view returns (uint160) {
    (int256 basePrice, int256 qoutePrice) = getScaledPrices();

    uint160 sqrtPriceX96 = uint160(
      OracleLib.sqrt(
        (
          (uint256(basePrice) << 96) / uint256(qoutePrice)
        )
      ) << 48
    );

    return sqrtPriceX96;
  }

  function getScaledPrices() public
    view returns (int256, int256) {
      (, int256 basePrice, , , ) = baseDataFeed
            .latestRoundData();
      uint8 baseDecimals = baseDataFeed.decimals();
      if (address(quoteDataFeed) == address(0)) {
        return (basePrice, int256(10 ** uint256(baseDecimals)));
      }
      uint8 quoteDecimals = quoteDataFeed.decimals();
      uint8 decimals = baseDecimals > quoteDecimals ? baseDecimals : quoteDecimals;

      basePrice = scalePrice(basePrice, baseDecimals, decimals);

      (, int256 quotePrice, , , ) = quoteDataFeed
          .latestRoundData();
      quotePrice = scalePrice(quotePrice, quoteDecimals, decimals);

      return (basePrice, quotePrice);
  }

  function scalePrice(
        int256 _price,
        uint8 _priceDecimals,
        uint8 _decimals
    ) internal pure returns (int256) {
      return _price * int256(10 ** uint256(_decimals - _priceDecimals));
    }
}