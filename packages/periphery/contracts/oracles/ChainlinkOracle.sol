// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

contract ChainlinkOracle is IPriceOracle, Ownable2Step {
    error InvalidTokenAddress();
    error BaseAndQuoteMustBeDifferent();
    error InvalidPrice();
    error InvalidDataFeed();
    error UnknownPair();

    struct OracleParams {
        AggregatorV3Interface dataFeed;
        bool isReverse;
    }

    uint256 private constant X96ONE = 79228162514264337593543950336;

    mapping(address => mapping(address => OracleParams)) public getParams;

    function setOptions(
        address quoteToken,
        address baseToken,
        address dataFeed
    ) external onlyOwner {
        if (quoteToken == baseToken) revert BaseAndQuoteMustBeDifferent();
        if (quoteToken == address(0)) revert InvalidTokenAddress();
        if (baseToken == address(0)) revert InvalidTokenAddress();
        if (dataFeed == address(0)) revert InvalidDataFeed();

        getParams[quoteToken][baseToken] = OracleParams({
            dataFeed: AggregatorV3Interface(dataFeed),
            isReverse: false
        });
        getParams[baseToken][quoteToken] = OracleParams({
            dataFeed: AggregatorV3Interface(dataFeed),
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

        if (address(params.dataFeed) == address(0)) revert UnknownPair();

        (
        /* uint80 roundID */,
            int answer,
        /* uint startedAt */,
        /* uint timeStamp */,
        /* uint80 answeredInRound */
        ) = params.dataFeed.latestRoundData();
        if (answer < 0) revert InvalidPrice();

        uint8 decimals = params.dataFeed.decimals();

        if (params.isReverse) {
            return Math.mulDiv(10 ** decimals, X96ONE, uint(answer));
        } else {
            return Math.mulDiv(uint(answer), X96ONE, 10 ** decimals);
        }
    }
}
