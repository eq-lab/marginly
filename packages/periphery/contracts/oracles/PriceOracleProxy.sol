// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

/// @notice Proxy contract for price oracles
/// Example: we assume that price for pt-sw-inwsteths/sw-inwsteths is the same as for pt-sw-inwsteths/inwsteths
contract PriceOracleProxy is IPriceOracle, Ownable2Step {
  struct OracleParams {
    address quoteToken;
    address baseToken;
    IPriceOracle priceOracle;
  }

  error ZeroPrice();
  error ZeroAddress();
  error InvalidTokenAddress();
  error NotInitialized();

  mapping(address => mapping(address => OracleParams)) public getParams;

  function setPair(
    address quoteToken,
    address baseToken,
    address underlyingQuoteToken,
    address underlyingBaseToken,
    IPriceOracle priceOracle
  ) external onlyOwner {
    if (address(priceOracle) == address(0)) revert ZeroAddress();
    if (baseToken == address(0)) revert ZeroAddress();
    if (quoteToken == address(0)) revert ZeroAddress();
    if (quoteToken == baseToken) revert InvalidTokenAddress();
    if (underlyingBaseToken == address(0)) revert ZeroAddress();
    if (underlyingQuoteToken == address(0)) revert ZeroAddress();
    if (underlyingBaseToken == underlyingQuoteToken) revert InvalidTokenAddress();

    // price request testing
    uint256 balancePrice = priceOracle.getBalancePrice(underlyingQuoteToken, underlyingBaseToken);
    uint256 margincallPrice = priceOracle.getMargincallPrice(underlyingQuoteToken, underlyingBaseToken);
    uint256 balancePriceInv = priceOracle.getBalancePrice(underlyingBaseToken, underlyingQuoteToken);
    uint256 margincallPriceInv = priceOracle.getMargincallPrice(underlyingBaseToken, underlyingQuoteToken);

    // Ensure the prices are non-zero to validate the oracle
    if (balancePrice == 0 || margincallPrice == 0 || balancePriceInv == 0 || margincallPriceInv == 0) {
      revert ZeroPrice();
    }

    OracleParams memory direct = OracleParams({
      priceOracle: priceOracle,
      quoteToken: underlyingQuoteToken,
      baseToken: underlyingBaseToken
    });
    OracleParams memory inverse = OracleParams({
      priceOracle: priceOracle,
      quoteToken: underlyingBaseToken,
      baseToken: underlyingQuoteToken
    });

    getParams[quoteToken][baseToken] = direct;
    getParams[baseToken][quoteToken] = inverse;
  }

  function _getParamsSafe(address quoteToken, address baseToken) private view returns (OracleParams memory) {
    OracleParams memory params = getParams[quoteToken][baseToken];
    if (params.quoteToken == address(0)) revert NotInitialized();
    return params;
  }

  /// @notice Returns price as X96 value
  function getBalancePrice(address quoteToken, address baseToken) external view returns (uint256) {
    OracleParams memory params = _getParamsSafe(quoteToken, baseToken);
    uint256 price = params.priceOracle.getBalancePrice(params.quoteToken, params.baseToken);
    if (price == 0) revert ZeroPrice();
    return price;
  }

  /// @notice Returns margin call price as X96 value
  function getMargincallPrice(address quoteToken, address baseToken) external view returns (uint256) {
    OracleParams memory params = _getParamsSafe(quoteToken, baseToken);
    uint256 price = params.priceOracle.getMargincallPrice(params.quoteToken, params.baseToken);
    if (price == 0) revert ZeroPrice();
    return price;
  }
}
