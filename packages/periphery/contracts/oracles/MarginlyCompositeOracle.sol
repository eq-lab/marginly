// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';
import './CompositeOracle.sol';

///@dev Composition of two IPriceOracles.
/// Should be used very carefully:
/// 1) not all implementations of IPriceOracle could be combined
/// 2) both IPriceOracle implementations must have the same time settings: secondsAgo, secondsAgoLiquidation
contract MarginlyCompositeOracle is IPriceOracle, Ownable2Step {
  error ZeroPrice();
  error ZeroAddress();
  error NotInitialized();
  error PairAlreadyExists();

  uint256 private constant X96ONE = 79228162514264337593543950336;

  struct OracleParams {
    address intermediateToken;
    IPriceOracle quoteIntermediateOracle;
    IPriceOracle interMediateBaseOracle;
  }

  mapping(address => mapping(address => OracleParams)) public getParams;

  function _validateOracle(IPriceOracle priceOracle, address quoteToken, address baseToken) private view {
    if (priceOracle.getBalancePrice(quoteToken, baseToken) == 0) revert ZeroPrice();
    if (priceOracle.getBalancePrice(baseToken, quoteToken) == 0) revert ZeroPrice();

    if (priceOracle.getMargincallPrice(quoteToken, baseToken) == 0) revert ZeroPrice();
    if (priceOracle.getMargincallPrice(baseToken, quoteToken) == 0) revert ZeroPrice();
  }

  function _getOracleParamsSafe(
    address quoteToken,
    address baseToken
  ) private view returns (OracleParams memory params) {
    params = getParams[quoteToken][baseToken];
    if (params.intermediateToken == address(0)) revert NotInitialized();
  }

  function setPair(
    address quoteToken,
    address intermediateToken,
    address baseToken,
    IPriceOracle quoteIntermediateOracle,
    IPriceOracle interMediateBaseOracle
  ) external onlyOwner {
    if (quoteToken == address(0)) revert ZeroAddress();
    if (intermediateToken == address(0)) revert ZeroAddress();
    if (baseToken == address(0)) revert ZeroAddress();
    if (address(quoteIntermediateOracle) == address(0)) revert ZeroAddress();
    if (address(interMediateBaseOracle) == address(0)) revert ZeroAddress();

    OracleParams memory params = getParams[quoteToken][baseToken];
    if (params.intermediateToken != address(0)) revert PairAlreadyExists();

    _validateOracle(quoteIntermediateOracle, quoteToken, intermediateToken);
    _validateOracle(interMediateBaseOracle, intermediateToken, baseToken);

    getParams[quoteToken][baseToken] = OracleParams({
      intermediateToken: intermediateToken,
      quoteIntermediateOracle: quoteIntermediateOracle,
      interMediateBaseOracle: interMediateBaseOracle
    });

    getParams[baseToken][quoteToken] = OracleParams({
      intermediateToken: intermediateToken,
      quoteIntermediateOracle: interMediateBaseOracle,
      interMediateBaseOracle: quoteIntermediateOracle
    });
  }

  function getBalancePrice(address quoteToken, address baseToken) external view override returns (uint256) {
    OracleParams memory params = _getOracleParamsSafe(quoteToken, baseToken);

    uint256 firstPrice = params.quoteIntermediateOracle.getBalancePrice(quoteToken, params.intermediateToken);
    uint256 secondPrice = params.interMediateBaseOracle.getBalancePrice(params.intermediateToken, baseToken);
    if (firstPrice == 0 || secondPrice == 0) revert ZeroPrice();

    return Math.mulDiv(firstPrice, secondPrice, X96ONE);
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view override returns (uint256) {
    OracleParams memory params = _getOracleParamsSafe(quoteToken, baseToken);

    uint256 firstPrice = params.quoteIntermediateOracle.getMargincallPrice(quoteToken, params.intermediateToken);
    uint256 secondPrice = params.interMediateBaseOracle.getMargincallPrice(params.intermediateToken, baseToken);
    if (firstPrice == 0 || secondPrice == 0) revert ZeroPrice();

    return Math.mulDiv(firstPrice, secondPrice, X96ONE);
  }
}
