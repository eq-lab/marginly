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
    address ibToken;
    address secondaryPoolOracle;
    uint8 ptSyDecimalsDelta;
  }

  uint256 private constant X96ONE = 2 ** 96;
  uint8 private constant PRICE_DECIMALS = 18;
  uint256 private constant PRICE_ONE = 10 ** PRICE_DECIMALS;

  IPPtLpOracle public immutable pendle;
  mapping(address => mapping(address => OracleParams)) public getParams;

  error ZeroPrice();
  error ZeroAddress();
  error WrongValue();
  error WrongPtAddress();
  error PairAlreadyExist();
  error UnknownPair();
  error PendlePtLpOracleIsNotInitialized(uint16);

  constructor(address _pendle) {
    if (_pendle == address(0)) revert ZeroAddress();
    pendle = IPPtLpOracle(_pendle);
  }

  /// @notice Create token pair oracle price params. Can be called only once per pair.
  /// @param quoteToken Quote token address e.g. WETH
  /// @param baseToken PT token e.g. PT-ezETH-27JUN2024
  /// @param pendleMarket Address of PendleMarket contract
  /// @param secondaryPoolOracle Address of additional pool oracle which implement IPriceOracle e.g. UniswapV3TickOracle
  /// @param ibToken Address of stacking/lending token wrapper e.g. ezETH, weETH
  /// @param secondsAgo Number of seconds in the past from which to calculate the time-weighted means
  /// @param secondsAgoLiquidation Same as `secondsAgo`, but for liquidation case
  function setPair(
    address quoteToken,
    address baseToken,
    address pendleMarket,
    address secondaryPoolOracle,
    address ibToken,
    uint16 secondsAgo,
    uint16 secondsAgoLiquidation
  ) external onlyOwner {
    if (secondsAgo == 0 || secondsAgoLiquidation == 0) revert WrongValue();
    if (secondsAgo < secondsAgoLiquidation) revert WrongValue();
    if (
      quoteToken == address(0) ||
      baseToken == address(0) ||
      pendleMarket == address(0) ||
      secondaryPoolOracle == address(0) ||
      ibToken == address(0)
    ) {
      revert ZeroAddress();
    }

    if (getParams[quoteToken][baseToken].pendleMarket != address(0)) revert PairAlreadyExist();

    _assertOracleIsInitialized(pendleMarket, secondsAgo);

    (IStandardizedYield sy, IPPrincipalToken pt, ) = PendleMarketV3(pendleMarket).readTokens();
    if (baseToken != address(pt)) revert WrongPtAddress();

    uint8 ptDecimals = IERC20Metadata(baseToken).decimals();
    uint8 syDecimals = IERC20Metadata(address(sy)).decimals();

    getParams[quoteToken][baseToken] = OracleParams({
      pendleMarket: pendleMarket,
      secondsAgo: secondsAgo,
      secondsAgoLiquidation: secondsAgoLiquidation,
      ibToken: ibToken,
      secondaryPoolOracle: secondaryPoolOracle,
      ptSyDecimalsDelta: PRICE_DECIMALS + ptDecimals - syDecimals
    });
  }

  /// @notice Update `secondsAgo` and `secondsAgoLiquidation` for token pair
  /// @param quoteToken Quote token address e.g. WETH
  /// @param baseToken PT token e.g. PT-ezETH-27JUN2024
  /// @param secondsAgo Number of seconds in the past from which to calculate the time-weighted means
  /// @param secondsAgoLiquidation Same as `secondsAgo`, but for liquidation case
  function updateTwapDuration(
    address quoteToken,
    address baseToken,
    uint16 secondsAgo,
    uint16 secondsAgoLiquidation
  ) external onlyOwner {
    if (secondsAgo < secondsAgoLiquidation) revert WrongValue();

    OracleParams storage params = getParams[quoteToken][baseToken];
    if (params.pendleMarket == address(0)) revert UnknownPair();

    params.secondsAgo = secondsAgo;
    params.secondsAgoLiquidation = secondsAgoLiquidation;
  }

  /// @notice Check Pendle oracle is initialized - https://docs.pendle.finance/Developers/Integration/HowToIntegratePtAndLpOracle#third-initialize-the-oracle
  function _assertOracleIsInitialized(address pendleMarket, uint16 secondsAgo) private view {
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
    if (poolParams.pendleMarket == address(0)) revert UnknownPair();

    // PT - base token
    // SY - wrapped yield token
    // YQT - yield quote token (e.g. ezETH)
    // QT - quote token (e.g. WETH)

    // Pendle market: PT / SY
    // 1.0 SY == 1.0 YQT
    // secondary pool: YQT / QT

    // getPtToSyRate() returns price with 18 decimals
    // after maturity getPtToSyRate() returns price != 1.0, so using PRICE_ONE when expired
    uint256 pendlePrice;
    if (IPMarket(poolParams.pendleMarket).isExpired()) {
      pendlePrice = PRICE_ONE;
    } else {
      pendlePrice = pendle.getPtToSyRate(
        poolParams.pendleMarket,
        isMargincallPrice ? poolParams.secondsAgoLiquidation : poolParams.secondsAgo
      );
    }

    if (isMargincallPrice) {
      priceX96 = Math.mulDiv(
        pendlePrice,
        IPriceOracle(poolParams.secondaryPoolOracle).getMargincallPrice(quoteToken, poolParams.ibToken),
        10 ** poolParams.ptSyDecimalsDelta
      );
    } else {
      priceX96 = Math.mulDiv(
        pendlePrice,
        IPriceOracle(poolParams.secondaryPoolOracle).getBalancePrice(quoteToken, poolParams.ibToken),
        10 ** poolParams.ptSyDecimalsDelta
      );
    }
  }
}
