// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@pendle/core-v2/contracts/oracles/PendlePtLpOracle.sol';
import '@pendle/core-v2/contracts/core/Market/v3/PendleMarketV3.sol';
import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

import './CompositeOracle.sol';

/// @notice Oracle for Pendle PT / underlying token, e.g. PT-ezETH-27JUN2024 / WETH
contract PendleOracle is IPriceOracle, Ownable2Step {
  struct OracleParams {
    address pendleMarket;
    uint16 secondsAgo;
    uint16 secondsAgoLiquidation;
    address yieldToken;
    address secondaryPoolOracle;
  }

  error ZeroPrice();
  error ZeroAddress();
  error WrongValue();

  PendlePtLpOracle public immutable pendle;
  mapping(address => mapping(address => OracleParams)) public getParams;

  uint256 private constant X96ONE = 2 ** 96;
  uint256 private constant ONE = 10 ** 18;

  constructor(address _pendle) {
    pendle = PendlePtLpOracle(_pendle);
  }

  function setPair(
    address quoteToken,
    address baseToken,
    address pendleMarket,
    address secondaryPoolOracle,
    address yieldToken,
    uint16 secondsAgo,
    uint16 secondsAgoLiquidation
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
    getParams[quoteToken][baseToken] = OracleParams({
      pendleMarket: pendleMarket,
      secondsAgo: secondsAgo,
      secondsAgoLiquidation: secondsAgoLiquidation,
      yieldToken: yieldToken,
      secondaryPoolOracle: secondaryPoolOracle
    });
    (bool increaseCardinalityRequired, uint16 cardinalityRequired, bool oldestObservationSatisfied) = pendle
      .getOracleState(pendleMarket, secondsAgo);

    // todo: check Pendle oracle is initialized - https://docs.pendle.finance/Developers/Integration/HowToIntegratePtAndLpOracle#third-initialize-the-oracle
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
    if (quoteToken == address(0)) revert ZeroAddress();
    if (baseToken == address(0)) revert ZeroAddress();

    OracleParams storage poolParams = getParams[quoteToken][baseToken];
    if (poolParams.pendleMarket == address(0)) revert ZeroAddress();

    uint256 pendlePriceX96 = Math.mulDiv(
      pendle.getPtToSyRate(
        poolParams.pendleMarket,
        isMargincallPrice ? poolParams.secondsAgoLiquidation : poolParams.secondsAgo
      ),
      X96ONE,
      ONE
    );

    // PT - base token
    // SY - wrapped yield token
    // YQT - yield quote token (e.g. ezETH)
    // QT - quote token (e.g. WETH)

    // Pendle market: PT / SY
    // 1.0 SY == 1.0 YQT
    // secondary pool: YQT / QT

    uint256 secondaryPoolPriceX96 = 0;
    if (isMargincallPrice) {
      secondaryPoolPriceX96 = IPriceOracle(poolParams.secondaryPoolOracle).getMargincallPrice(
        quoteToken,
        poolParams.yieldToken
      );
    } else {
      secondaryPoolPriceX96 = IPriceOracle(poolParams.secondaryPoolOracle).getBalancePrice(
        quoteToken,
        poolParams.yieldToken
      );
    }

    priceX96 = Math.mulDiv(pendlePriceX96, secondaryPoolPriceX96, X96ONE);
  }
}
