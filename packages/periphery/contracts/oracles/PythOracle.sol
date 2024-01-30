// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

import './CompositeOracle.sol';

contract PythOracle is IPriceOracle, CompositeOracle, Ownable2Step {
    struct OracleParams {
        bytes32 tokenPriceId;
    }

    IPyth public immutable pyth;
    mapping(address => mapping(address => OracleParams)) public getParams;

    constructor(address _pyth){
        pyth = IPyth(_pyth);
    }

    function setPair(
        address quoteToken,
        address baseToken,
        bytes32 tokenPriceId
    ) external onlyOwner {
        _setCommonPair(quoteToken, baseToken);

        getParams[quoteToken][baseToken] = OracleParams({
            tokenPriceId: tokenPriceId
        });
        getParams[baseToken][quoteToken] = OracleParams({
            tokenPriceId: tokenPriceId
        });
    }

    function setCompositePair(
        address quoteToken,
        address intermediateToken,
        address baseToken
    ) external onlyOwner {
        _setCompositePair(quoteToken, intermediateToken, baseToken);
    }

    function getBalancePrice(
        address quoteToken,
        address baseToken
    ) external view returns (uint256) {
        return _getPrice(quoteToken, baseToken);
    }

    function getMargincallPrice(
        address quoteToken,
        address baseToken
    ) external view returns (uint256) {
        return _getPrice(quoteToken, baseToken);
    }

    function getRationalPrice(
        address quoteToken,
        address baseToken
    ) internal override view returns (uint256, uint256) {
        OracleParams memory params = getParams[quoteToken][baseToken];

        PythStructs.Price memory currentPrice = pyth.getPrice(
            params.tokenPriceId
        );

        int expo = currentPrice.expo;
        bool isNegativeExpo = expo < 0;
        uint absExpo = uint(expo < 0 ? - expo : expo);

        if (currentPrice.price < 0) revert InvalidPrice();
        uint price = uint(int(currentPrice.price));

        uint priceNom = isNegativeExpo ? price : price * 10 ** absExpo;
        uint priceDenom = isNegativeExpo ? 10 ** absExpo : 1;

        return (priceNom, priceDenom);
    }
}
