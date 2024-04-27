// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

abstract contract CompositeOracle {
  error InvalidTokenAddress();
  error BaseAndQuoteMustBeDifferent();
  error InvalidPrice();
  error UnknownPair();
  error InvalidMode();

  enum PairMode {
    NotInitialized,
    Direct,
    Reverse,
    Composite
  }

  struct OracleCommonParams {
    PairMode pairMode;
    uint8 quoteDecimals;
    uint8 baseDecimals;
  }

  uint256 private constant X96ONE = 79228162514264337593543950336;

  mapping(address => mapping(address => OracleCommonParams)) public getCommonParams;
  mapping(address => mapping(address => address)) public getIntermediateToken;

  /// @dev If quoteToken is equal to address(0), it means that the quote token is not erc-20 token and has zero decimals, e.g. data feed WETH/USD
  function _setCommonPair(address quoteToken, address baseToken) internal {
    if (quoteToken == baseToken) revert BaseAndQuoteMustBeDifferent();

    uint8 quoteDecimals = quoteToken == address(0) ? 0 : IERC20Metadata(quoteToken).decimals();
    uint8 baseDecimals = baseToken == address(0) ? 0 : IERC20Metadata(baseToken).decimals();

    getCommonParams[quoteToken][baseToken] = OracleCommonParams({
      pairMode: PairMode.Direct,
      quoteDecimals: quoteDecimals,
      baseDecimals: baseDecimals
    });
    // reverse decimals for the reverse pair
    getCommonParams[baseToken][quoteToken] = OracleCommonParams({
      pairMode: PairMode.Reverse,
      quoteDecimals: baseDecimals,
      baseDecimals: quoteDecimals
    });
  }

  /// @dev If intermediateToken is equal to address(0), it means that we are using a composite oracle of two price feeds to get the final price, e.g. ARB/USD and ETH/USD to get the final price ARB/ETH.
  function _setCompositePair(address quoteToken, address intermediateToken, address baseToken) internal {
    OracleCommonParams memory quoteParams = getCommonParams[quoteToken][intermediateToken];
    if (quoteParams.pairMode != PairMode.Direct && quoteParams.pairMode != PairMode.Reverse) revert InvalidMode();

    OracleCommonParams memory baseParams = getCommonParams[intermediateToken][baseToken];
    if (baseParams.pairMode != PairMode.Direct && baseParams.pairMode != PairMode.Reverse) revert InvalidMode();

    getCommonParams[quoteToken][baseToken] = OracleCommonParams({
      pairMode: PairMode.Composite,
      quoteDecimals: quoteParams.quoteDecimals,
      baseDecimals: baseParams.baseDecimals
    });
    // reverse decimals for the reverse pair
    getCommonParams[baseToken][quoteToken] = OracleCommonParams({
      pairMode: PairMode.Composite,
      quoteDecimals: baseParams.baseDecimals,
      baseDecimals: quoteParams.quoteDecimals
    });

    getIntermediateToken[quoteToken][baseToken] = intermediateToken;
    getIntermediateToken[baseToken][quoteToken] = intermediateToken;
  }

  function getRationalPrice(address quoteToken, address baseToken) internal view virtual returns (uint256, uint256);

  function applyDirection(uint256 nom, uint256 denom, PairMode pairMode) private pure returns (uint256, uint256) {
    return pairMode == PairMode.Direct ? (nom, denom) : (denom, nom);
  }

  function _getPrice(address quoteToken, address baseToken) internal view returns (uint256) {
    OracleCommonParams memory commonParams = getCommonParams[quoteToken][baseToken];

    if (commonParams.pairMode == PairMode.NotInitialized) revert UnknownPair();

    if (commonParams.pairMode == PairMode.Direct || commonParams.pairMode == PairMode.Reverse) {
      (uint256 priceNom, uint256 priceDenom) = getRationalPrice(quoteToken, baseToken);
      (priceNom, priceDenom) = applyDirection(priceNom, priceDenom, commonParams.pairMode);

      return
        Math.mulDiv(priceNom * 10 ** commonParams.quoteDecimals, X96ONE, priceDenom * 10 ** commonParams.baseDecimals);
    }

    if (commonParams.pairMode == PairMode.Composite) {
      address intermediateToken = getIntermediateToken[quoteToken][baseToken];

      OracleCommonParams memory quoteCommonParams = getCommonParams[quoteToken][intermediateToken];
      (uint256 quoteNom, uint256 quoteDenom) = getRationalPrice(quoteToken, intermediateToken);
      (quoteNom, quoteDenom) = applyDirection(quoteNom, quoteDenom, quoteCommonParams.pairMode);

      OracleCommonParams memory baseCommonParams = getCommonParams[intermediateToken][baseToken];
      (uint256 baseNom, uint256 baseDenom) = getRationalPrice(intermediateToken, baseToken);
      (baseNom, baseDenom) = applyDirection(baseNom, baseDenom, baseCommonParams.pairMode);

      return
        Math.mulDiv(
          quoteNom * baseNom * 10 ** commonParams.quoteDecimals,
          X96ONE,
          quoteDenom * baseDenom * 10 ** commonParams.baseDecimals
        );
    }

    revert InvalidMode();
  }
}
