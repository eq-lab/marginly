// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import './MarginlyPool.sol';

contract FullMarginlyPool is MarginlyPool {
    constructor(
        address _quoteToken,
        address _baseToken,
        uint24 _uniswapFee,
        bool _quoteTokenIsToken0,
        address _uniswapPool,
        MarginlyParams memory _params
    ) MarginlyPool() {
        _initializeMarginlyPool(
            _quoteToken,
            _baseToken,
            _uniswapFee,
            _quoteTokenIsToken0,
            _uniswapPool,
            _params
        );
    }

    function initialize(
        address _quoteToken,
        address _baseToken,
        uint24 _uniswapFee,
        bool _quoteTokenIsToken0,
        address _uniswapPool,
        MarginlyParams calldata _params
    ) external override {
        require(factory == address(0), 'FB'); // Forbidden
    }

    function getParams() external view returns (
        uint8 maxLeverage,
        uint16 priceSecondsAgo,
        uint24 interestRate,
        uint24 swapFee,
        uint24 positionSlippage,
        uint24 mcSlippage,
        uint96 positionMinAmount,
        uint96 baseLimit,
        uint96 quoteLimit
    ) {
        maxLeverage = params.maxLeverage;
        priceSecondsAgo = params.priceSecondsAgo;
        interestRate = params.interestRate;
        swapFee = params.swapFee;
        positionSlippage = params.positionSlippage;
        mcSlippage = params.mcSlippage;
        positionMinAmount = params.positionMinAmount;
        baseLimit = params.baseLimit;
        quoteLimit = params.quoteLimit;
    }
}
