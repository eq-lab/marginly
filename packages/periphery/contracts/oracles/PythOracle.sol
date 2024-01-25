// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

contract PythOracle is IPriceOracle, Ownable2Step {
    error InvalidTokenAddress();
    error BaseAndQuoteMustBeDifferent();
    error InvalidPrice();
    error UnknownPair();

    struct OracleParams {
        bytes32 tokenPriceId;
        bool isInitialized;
        bool isReverse;
    }

    uint256 private constant X96ONE = 79228162514264337593543950336;

    IPyth public immutable pyth;
    mapping(address => mapping(address => OracleParams)) public getParams;

    constructor(address _pyth){
        pyth = IPyth(_pyth);
    }

    function setOptions(
        address quoteToken,
        address baseToken,
        bytes32 tokenPriceId
    ) external onlyOwner {
        if (quoteToken == baseToken) revert BaseAndQuoteMustBeDifferent();
        if (quoteToken == address(0)) revert InvalidTokenAddress();
        if (baseToken == address(0)) revert InvalidTokenAddress();

        getParams[quoteToken][baseToken] = OracleParams({
            tokenPriceId: tokenPriceId,
            isInitialized: true,
            isReverse: false
        });
        getParams[baseToken][quoteToken] = OracleParams({
            tokenPriceId: tokenPriceId,
            isInitialized: true,
            isReverse: true
        });
    }

    function getBalancePrice(
        address quoteToken,
        address baseToken
    ) external view returns (uint256) {
        return getPrice(quoteToken, baseToken);
    }

    function getMargincallPrice(
        address quoteToken,
        address baseToken
    ) external view returns (uint256) {
        return getPrice(quoteToken, baseToken);
    }

    function getPrice(
        address quoteToken,
        address baseToken
    ) private view returns (uint256) {
        OracleParams memory params = getParams[quoteToken][baseToken];

        if (!params.isInitialized) revert UnknownPair();

        PythStructs.Price memory currentPrice = pyth.getPrice(
            params.tokenPriceId
        );

        int expo = currentPrice.expo;
        bool isNegativeExpo = expo < 0;
        uint absExpo = uint(expo < 0 ? -expo : expo);

        if (currentPrice.price < 0) revert InvalidPrice();
        uint price = uint(int(currentPrice.price));

        uint priceNom = isNegativeExpo ? price : price * 10 ** absExpo;
        uint priceDenom = isNegativeExpo ? 10 ** absExpo : 1;

        if (params.isReverse) {
            return Math.mulDiv(priceDenom, X96ONE, priceNom);
        } else {
            return Math.mulDiv(priceNom, X96ONE, priceDenom);
        }
    }
}
