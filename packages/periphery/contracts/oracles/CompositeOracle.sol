// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/utils/math/Math.sol';

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
    }

    uint256 private constant X96ONE = 79228162514264337593543950336;

    mapping(address => mapping(address => OracleCommonParams)) public getCommonParams;
    mapping(address => mapping(address => address)) public getIntermediateToken;

    function _setCommonPair(
        address quoteToken,
        address baseToken
    ) internal {
        if (quoteToken == baseToken) revert BaseAndQuoteMustBeDifferent();
        if (quoteToken == address(0)) revert InvalidTokenAddress();
        if (baseToken == address(0)) revert InvalidTokenAddress();

        getCommonParams[quoteToken][baseToken] = OracleCommonParams({
            pairMode: PairMode.Direct
        });
        getCommonParams[baseToken][quoteToken] = OracleCommonParams({
            pairMode: PairMode.Reverse
        });
    }

    function _setCompositePair(
        address quoteToken,
        address intermediateToken,
        address baseToken
    ) internal {
        if (intermediateToken == address(0)) revert InvalidTokenAddress();

        OracleCommonParams memory quoteParams = getCommonParams[quoteToken][intermediateToken];
        if (quoteParams.pairMode != PairMode.Direct && quoteParams.pairMode != PairMode.Reverse) revert InvalidMode();

        OracleCommonParams memory baseParams = getCommonParams[intermediateToken][baseToken];
        if (baseParams.pairMode != PairMode.Direct && baseParams.pairMode != PairMode.Reverse) revert InvalidMode();

        getCommonParams[quoteToken][baseToken] = OracleCommonParams({
            pairMode: PairMode.Composite
        });
        getCommonParams[baseToken][quoteToken] = OracleCommonParams({
            pairMode: PairMode.Composite
        });

        getIntermediateToken[quoteToken][baseToken] = intermediateToken;
        getIntermediateToken[baseToken][quoteToken] = intermediateToken;
    }

    function getRationalPrice(
        address quoteToken,
        address baseToken
    ) internal virtual view returns (uint256, uint256);

    function applyDirection(uint256 nom, uint256 denom, PairMode pairMode) private pure returns (uint256, uint256) {
        return pairMode == PairMode.Direct ? (nom, denom) : (denom, nom);
    }

    function _getPrice(
        address quoteToken,
        address baseToken
    ) internal view returns (uint256) {
        OracleCommonParams memory commonParams = getCommonParams[quoteToken][baseToken];

        if (commonParams.pairMode == PairMode.NotInitialized) revert UnknownPair();

        if (commonParams.pairMode == PairMode.Direct || commonParams.pairMode == PairMode.Reverse) {
            (uint256 priceNom, uint256 priceDenom) = getRationalPrice(quoteToken, baseToken);
            (priceNom, priceDenom) = applyDirection(priceNom, priceDenom, commonParams.pairMode);

            return Math.mulDiv(priceNom, X96ONE, priceDenom);
        }

        if (commonParams.pairMode == PairMode.Composite) {
            address intermediateToken = getIntermediateToken[quoteToken][baseToken];

            OracleCommonParams memory quoteCommonParams = getCommonParams[quoteToken][intermediateToken];
            (uint256 quoteNom, uint256 quoteDenom) = getRationalPrice(quoteToken, intermediateToken);
            (quoteNom, quoteDenom) = applyDirection(quoteNom, quoteDenom, quoteCommonParams.pairMode);

            OracleCommonParams memory baseCommonParams = getCommonParams[intermediateToken][baseToken];
            (uint256 baseNom, uint256 baseDenom) = getRationalPrice(intermediateToken, baseToken);
            (baseNom, baseDenom) = applyDirection(baseNom, baseDenom, baseCommonParams.pairMode);

            return Math.mulDiv(quoteNom * baseNom, X96ONE, quoteDenom * baseDenom);
        }

        revert InvalidMode();
    }
}
