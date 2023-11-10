// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import './libraries/OracleLib.sol';

contract PriceAdapter is IUniswapV3Pool {
  AggregatorV3Interface public baseDataFeed;
  AggregatorV3Interface public quoteDataFeed;

  constructor(address _baseDataFeed, address _quoteDataFeed) {
    baseDataFeed = AggregatorV3Interface(_baseDataFeed);
    quoteDataFeed = AggregatorV3Interface(_quoteDataFeed);
  }

  function factory() external view override returns (address) {}

  function token0() external view override returns (address) {}

  function token1() external view override returns (address) {}

  function fee() external view override returns (uint24) {}

  function tickSpacing() external view override returns (int24) {}

  function maxLiquidityPerTick() external view override returns (uint128) {}

  function slot0()
    external
    view
    override
    returns (
      uint160 sqrtPriceX96,
      int24 tick,
      uint16 observationIndex,
      uint16 observationCardinality,
      uint16 observationCardinalityNext,
      uint8 feeProtocol,
      bool unlocked
    )
  {}

  function feeGrowthGlobal0X128() external view override returns (uint256) {}

  function feeGrowthGlobal1X128() external view override returns (uint256) {}

  function protocolFees() external view override returns (uint128 _token0, uint128 _token1) {}

  function liquidity() external view override returns (uint128) {}

  function ticks(
    int24 tick
  )
    external
    view
    override
    returns (
      uint128 liquidityGross,
      int128 liquidityNet,
      uint256 feeGrowthOutside0X128,
      uint256 feeGrowthOutside1X128,
      int56 tickCumulativeOutside,
      uint160 secondsPerLiquidityOutsideX128,
      uint32 secondsOutside,
      bool initialized
    )
  {}

  function tickBitmap(int16 wordPosition) external view override returns (uint256) {}

  function positions(
    bytes32 key
  )
    external
    view
    override
    returns (
      uint128 _liquidity,
      uint256 feeGrowthInside0LastX128,
      uint256 feeGrowthInside1LastX128,
      uint128 tokensOwed0,
      uint128 tokensOwed1
    )
  {}

  function observations(
    uint256 index
  )
    external
    view
    override
    returns (uint32 blockTimestamp, int56 tickCumulative, uint160 secondsPerLiquidityCumulativeX128, bool initialized)
  {}

  function observe(
    uint32[] calldata secondsAgos
  )
    external
    view
    override
    returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
  {
    secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);
    secondsPerLiquidityCumulativeX128s[0] = secondsAgos[0];
    secondsPerLiquidityCumulativeX128s[1] = secondsAgos[1];

    uint160 sqrtPriceX96 = getSqrtPriceX96();
    tickCumulatives = OracleLib.getCumulativeTickAtSqrtRatio(sqrtPriceX96, secondsAgos);
  }

  function getSqrtPriceX96() public view returns (uint160) {
    (int256 price, int256 decimals) = getPrice();

    uint160 sqrtPriceX96 = uint160((OracleLib.sqrt(((uint256(price) << 96) / uint256(decimals))) << 48));

    return sqrtPriceX96;
  }

  function getPrice() public
    view returns (int256, int256) {
      (, int256 basePrice, , , ) = baseDataFeed
            .latestRoundData();
      uint8 baseDecimals = baseDataFeed.decimals();
      if (address(quoteDataFeed) == address(0)) {
        return (basePrice, int256(10 ** uint256(baseDecimals)));
      }
      uint8 quoteDecimals = quoteDataFeed.decimals();
      uint8 _decimals = baseDecimals > quoteDecimals ? baseDecimals : quoteDecimals;
      int256 decimals = int256(10 ** uint256(_decimals));

      basePrice = scalePrice(basePrice, baseDecimals, _decimals);

      (, int256 quotePrice, , , ) = quoteDataFeed
          .latestRoundData();
      quotePrice = scalePrice(quotePrice, quoteDecimals, _decimals);

      return ((basePrice * decimals) / quotePrice, decimals);
  }

  function scalePrice(
        int256 _price,
        uint8 _priceDecimals,
        uint8 _decimals
    ) internal pure returns (int256) {
        if (_priceDecimals < _decimals) {
            return _price * int256(10 ** uint256(_decimals - _priceDecimals));
        } else if (_priceDecimals > _decimals) {
            return _price / int256(10 ** uint256(_priceDecimals - _decimals));
        }
        return _price;
    }

  function snapshotCumulativesInside(
    int24 tickLower,
    int24 tickUpper
  )
    external
    view
    override
    returns (int56 tickCumulativeInside, uint160 secondsPerLiquidityInsideX128, uint32 secondsInside)
  {}

  function initialize(uint160 sqrtPriceX96) external override {}

  function mint(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount,
    bytes calldata data
  ) external override returns (uint256 amount0, uint256 amount1) {}

  function collect(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount0Requested,
    uint128 amount1Requested
  ) external override returns (uint128 amount0, uint128 amount1) {}

  function burn(
    int24 tickLower,
    int24 tickUpper,
    uint128 amount
  ) external override returns (uint256 amount0, uint256 amount1) {}

  function swap(
    address recipient,
    bool zeroForOne,
    int256 amountSpecified,
    uint160 sqrtPriceLimitX96,
    bytes calldata data
  ) external override returns (int256 amount0, int256 amount1) {}

  function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external override {}

  function increaseObservationCardinalityNext(uint16 observationCardinalityNext) external override {}

  function setFeeProtocol(uint8 feeProtocol0, uint8 feeProtocol1) external override {}

  function collectProtocol(
    address recipient,
    uint128 amount0Requested,
    uint128 amount1Requested
  ) external override returns (uint128 amount0, uint128 amount1) {}
}