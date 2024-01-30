// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

import './CompositeOracle.sol';

contract ChainlinkOracle is IPriceOracle, CompositeOracle, Ownable2Step {
    struct OracleParams {
        AggregatorV3Interface dataFeed;
    }

    mapping(address => mapping(address => OracleParams)) public getParams;

    function setPair(
        address quoteToken,
        address baseToken,
        address dataFeed
    ) external onlyOwner {
        _setCommonPair(quoteToken, baseToken);

        getParams[quoteToken][baseToken] = OracleParams({
            dataFeed: AggregatorV3Interface(dataFeed)
        });
        getParams[baseToken][quoteToken] = OracleParams({
            dataFeed: AggregatorV3Interface(dataFeed)
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

        (
        /* uint80 roundID */,
            int answer,
        /* uint startedAt */,
        /* uint timeStamp */,
        /* uint80 answeredInRound */
        ) = params.dataFeed.latestRoundData();
        if (answer < 0) revert InvalidPrice();

        uint8 decimals = params.dataFeed.decimals();

        return (uint256(answer), 10 ** decimals);
    }
}
