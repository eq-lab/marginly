// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@pendle/core-v2/contracts/oracles/PendlePtLpOracle.sol';
import '@pendle/core-v2/contracts/core/Market/v3/PendleMarketV3.sol';
import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

/// @notice Oracle for Pendle PT / underlying token, e.g. PT-ezETH-27JUN2024 / WETH
contract PendleOracle is IPriceOracle, Ownable2Step {
  struct OracleParams {
    address pendleMarket;
    uint16 secondsAgo;
    uint16 secondsAgoLiquidation;
    address yieldToken;
    address secondaryPoolOracle;
    uint8 ptDecimals;
    uint8 syDecimals;
    bool usePtToSyOracle;
  }

  error ZeroPrice();
  error ZeroAddress();
  error WrongValue();
  error PendlePtLpOracleIsNotInitialized(uint16);

  IPPtLpOracle public immutable pendle;
  mapping(address => mapping(address => OracleParams)) public getParams;

  uint256 private constant X96ONE = 2 ** 96;
  uint256 private constant PRICE_DECIMALS = 18;

  constructor(address _pendle) {
    if (_pendle == address(0)) revert ZeroAddress();
    pendle = IPPtLpOracle(_pendle);
  }

  function setPair(
    address quoteToken,
    address baseToken,
    address pendleMarket,
    address secondaryPoolOracle,
    address yieldToken,
    uint16 secondsAgo,
    uint16 secondsAgoLiquidation,
    bool usePtToSyOracle
  ) external onlyOwner {
    if (secondsAgo == 0 || secondsAgoLiquidation == 0) revert WrongValue();
    if (
      quoteToken == address(0) ||
      baseToken == address(0) ||
      pendleMarket == address(0) ||
      secondaryPoolOracle == address(0) ||
      yieldToken == address(0)
    ) {
      revert ZeroAddress();
    }

    _assertOracleIsInitialized(pendleMarket, secondsAgo);
    _assertOracleIsInitialized(pendleMarket, secondsAgoLiquidation);

    (IStandardizedYield sy, , ) = PendleMarketV3(pendleMarket).readTokens();
    uint8 ptDecimals = IERC20Metadata(baseToken).decimals();
    uint8 syDecimals = IERC20Metadata(address(sy)).decimals();

    getParams[quoteToken][baseToken] = OracleParams({
      pendleMarket: pendleMarket,
      secondsAgo: secondsAgo,
      secondsAgoLiquidation: secondsAgoLiquidation,
      yieldToken: yieldToken,
      secondaryPoolOracle: secondaryPoolOracle,
      ptDecimals: ptDecimals,
      syDecimals: syDecimals,
      usePtToSyOracle: usePtToSyOracle
    });
  }

  /// @notice check Pendle oracle is initialized - https://docs.pendle.finance/Developers/Integration/HowToIntegratePtAndLpOracle#third-initialize-the-oracle
  function _assertOracleIsInitialized(address pendleMarket, uint16 secondsAgo) private {
    (bool increaseCardinalityRequired, , bool oldestObservationSatisfied) = pendle.getOracleState(
      pendleMarket,
      secondsAgo
    );
    if (increaseCardinalityRequired) revert PendlePtLpOracleIsNotInitialized(secondsAgo);
    if (!oldestObservationSatisfied) revert PendlePtLpOracleIsNotInitialized(secondsAgo);
  }

  function getBalancePrice(address quoteToken, address baseToken) external view returns (uint256) {
    return _getPriceX96(quoteToken, baseToken, false);
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view returns (uint256) {
    return _getPriceX96(quoteToken, baseToken, true);
  }

  function _getPriceX96(
    address quoteToken,
    address baseToken,
    bool isMargincallPrice
  ) private view returns (uint256 priceX96) {
    OracleParams storage poolParams = getParams[quoteToken][baseToken];
    if (poolParams.pendleMarket == address(0)) revert ZeroAddress();

    // PT - base token
    // SY - wrapped yield token
    // YQT - yield quote token (e.g. ezETH)
    // QT - quote token (e.g. WETH)

    // Pendle market: PT / SY
    // 1.0 SY == 1.0 YQT
    // secondary pool: YQT / QT

    // getPtToSyRate() and getPtToAssetRate() returns price with 18 decimals
    uint256 pendlePrice = 0;

    if (poolParams.usePtToSyOracle) {
      pendlePrice = pendle.getPtToSyRate(
        poolParams.pendleMarket,
        isMargincallPrice ? poolParams.secondsAgoLiquidation : poolParams.secondsAgo
      );
    } else {
      pendlePrice = pendle.getPtToAssetRate(
        poolParams.pendleMarket,
        isMargincallPrice ? poolParams.secondsAgoLiquidation : poolParams.secondsAgo
      );
    }

    if (isMargincallPrice) {
      priceX96 = Math.mulDiv(
        pendlePrice,
        IPriceOracle(poolParams.secondaryPoolOracle).getMargincallPrice(quoteToken, poolParams.yieldToken),
        10 ** (PRICE_DECIMALS + poolParams.ptDecimals - poolParams.syDecimals)
      );
    } else {
      priceX96 = Math.mulDiv(
        pendlePrice,
        IPriceOracle(poolParams.secondaryPoolOracle).getBalancePrice(quoteToken, poolParams.yieldToken),
        10 ** (PRICE_DECIMALS + poolParams.ptDecimals - poolParams.syDecimals)
      );
    }
  }
}
