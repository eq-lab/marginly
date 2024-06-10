// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@pendle/core-v2/contracts/oracles/PendlePtLpOracle.sol';
import '@pendle/core-v2/contracts/core/Market/v3/PendleMarketV3.sol';
import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

/// @dev Oracle to get price from Pendle market Pt to Ib token
contract PendleMarketOracle is IPriceOracle, Ownable2Step {
  struct OracleParams {
    address pendleMarket;
    address ibToken;
    uint16 secondsAgo;
    uint16 secondsAgoLiquidation;
    uint8 ptSyDecimalsDelta;
  }

  uint256 private constant X96ONE = 2 ** 96;
  uint8 private constant PRICE_DECIMALS = 18;

  IPPtLpOracle public immutable pendle;
  mapping(address => mapping(address => OracleParams)) public getParams;

  error ZeroPrice();
  error ZeroAddress();
  error WrongValue();
  error WrongIbSyDecimals();
  error WrongPtAddress();
  error WrongIbTokenAddress();
  error PairAlreadyExist();
  error UnknownPair();
  error PendlePtLpOracleIsNotInitialized(uint16);

  constructor(address _pendle) {
    if (_pendle == address(0)) revert ZeroAddress();
    pendle = IPPtLpOracle(_pendle);
  }

  /// @notice Create token pair oracle price params. Can be called only once per pair.
  /// @param quoteToken address of IbToken or PtToken
  /// @param baseToken address of PtToken or IbToken
  /// @param pendleMarket Address of PendleMarket contract with PtToken and IbToken
  /// @param secondsAgo Number of seconds in the past from which to calculate the time-weighted means
  /// @param secondsAgoLiquidation Same as `secondsAgo`, but for liquidation case
  function setPair(
    address quoteToken,
    address baseToken,
    address pendleMarket,
    uint16 secondsAgo,
    uint16 secondsAgoLiquidation
  ) external onlyOwner {
    if (secondsAgo == 0 || secondsAgoLiquidation == 0) revert WrongValue();
    if (secondsAgo < secondsAgoLiquidation) revert WrongValue();
    if (quoteToken == address(0) || baseToken == address(0) || pendleMarket == address(0)) {
      revert ZeroAddress();
    }

    if (getParams[quoteToken][baseToken].pendleMarket != address(0)) revert PairAlreadyExist();

    _assertOracleIsInitialized(pendleMarket, secondsAgo);

    (IStandardizedYield sy, IPPrincipalToken pt, ) = PendleMarketV3(pendleMarket).readTokens();
    address ibToken;
    if (baseToken == address(pt)) {
      ibToken = quoteToken;
    } else if (quoteToken == address(pt)) {
      ibToken = baseToken;
    } else {
      revert WrongPtAddress();
    }

    if (!sy.isValidTokenIn(ibToken) || !sy.isValidTokenOut(ibToken)) revert WrongIbTokenAddress();

    uint8 ptDecimals = IERC20Metadata(baseToken).decimals();
    uint8 syDecimals = IERC20Metadata(address(sy)).decimals();
    uint8 ibDecimals = IERC20Metadata(ibToken).decimals();

    //We assume that sy ib ratio is 1:1 and decimals for both tokens are equals
    if (syDecimals != ibDecimals) revert WrongIbSyDecimals();

    OracleParams memory oracleParams = OracleParams({
      pendleMarket: pendleMarket,
      ibToken: ibToken,
      secondsAgo: secondsAgo,
      secondsAgoLiquidation: secondsAgoLiquidation,
      ptSyDecimalsDelta: PRICE_DECIMALS + ptDecimals - syDecimals
    });

    getParams[quoteToken][baseToken] = oracleParams;
    getParams[baseToken][quoteToken] = oracleParams;
  }

  /// @notice Update `secondsAgo` and `secondsAgoLiquidation` for token pair
  /// @param quoteToken Quote token address, IbToken e.g. ezETH
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

    OracleParams memory oracleParams = getParams[quoteToken][baseToken];
    if (oracleParams.pendleMarket == address(0)) revert UnknownPair();

    oracleParams.secondsAgo = secondsAgo;
    oracleParams.secondsAgoLiquidation = secondsAgoLiquidation;

    getParams[quoteToken][baseToken] = oracleParams;
    getParams[baseToken][quoteToken] = oracleParams;
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

    uint256 pendlePrice = pendle.getPtToSyRate(
      poolParams.pendleMarket,
      isMargincallPrice ? poolParams.secondsAgoLiquidation : poolParams.secondsAgo
    );

    priceX96 = poolParams.ibToken == quoteToken
      ? Math.mulDiv(pendlePrice, X96ONE, 10 ** poolParams.ptSyDecimalsDelta)
      : Math.mulDiv(X96ONE, 10 ** poolParams.ptSyDecimalsDelta, pendlePrice);
  }
}
