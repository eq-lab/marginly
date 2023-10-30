// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import {ILBLegacyPair} from './ILBLegacyPair.sol';
import {Constants} from './Constants.sol';
import {Math128x128} from './Math128x128.sol';
import '../../libraries/OracleLib.sol';
import '../Math.sol';

contract TraderJoeV2PiceAdapter is IUniswapV3Pool {
  using Math128x128 for uint256;

  error BinHelper__BinStepOverflows(uint256 bp);
  error BinHelper__IdOverflows();

  address public pool;

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
      secondsPerLiquidityCumulativeX128s[0] = secondsAgos[0];
      secondsPerLiquidityCumulativeX128s[1] = secondsAgos[1];

      ILBLegacyPair legacyPair = ILBLegacyPair(pool);
      uint256 binStep = uint256((legacyPair.feeParameters()).binStep);
      (uint256 cumulativeId0,,) = legacyPair.getOracleSampleFrom(block.timestamp - uint256(secondsAgos[0]));
      (uint256 cumulativeId1,,) = legacyPair.getOracleSampleFrom(block.timestamp - uint256(secondsAgos[1]));
      // 128.128-binary fixed-point number
      uint256 price0 = getPriceFromId(cumulativeId0, binStep);
      uint256 price1 = getPriceFromId(cumulativeId1, binStep);
      uint160 sqrtPrice0X96 = uint160(Math.sqrt(price0) << 32);
      uint160 sqrtPrice1X96 = uint160(Math.sqrt(price1) << 32);
      int56 tick0 = OracleLib.getTickAtSqrtRatio(sqrtPrice0X96);
      int56 tick1 = OracleLib.getTickAtSqrtRatio(sqrtPrice1X96);
      tickCumulatives[0] = tick0;
      tickCumulatives[1] = tick1;
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

  /// @notice Returns the price corresponding to the given ID, as a 128.128-binary fixed-point number
  /// @dev This is the trusted function to link id to price, the other way may be inaccurate
  /// @param _id The id
  /// @param _binStep The bin step
  /// @return The price corresponding to this id, as a 128.128-binary fixed-point number
  function getPriceFromId(uint256 _id, uint256 _binStep) internal pure returns (uint256) {
      if (_id > uint256(type(uint24).max)) revert BinHelper__IdOverflows();
      unchecked {
          int256 _realId = int256(_id) - Constants.REAL_ID_SHIFT;

          return _getBPValue(_binStep).power(_realId);
      }
  }

  /// @notice Returns the (1 + bp) value as a 128.128-decimal fixed-point number
  /// @param _binStep The bp value in [1; 100] (referring to 0.01% to 1%)
  /// @return The (1+bp) value as a 128.128-decimal fixed-point number
  function _getBPValue(uint256 _binStep) internal pure returns (uint256) {
      if (_binStep == 0 || _binStep > Constants.BASIS_POINT_MAX) revert BinHelper__BinStepOverflows(_binStep);

      unchecked {
          // can't overflow as `max(result) = 2**128 + 10_000 << 128 / 10_000 < max(uint256)`
          return Constants.SCALE + (_binStep << Constants.SCALE_OFFSET) / Constants.BASIS_POINT_MAX;
      }
  }
}