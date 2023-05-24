// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import '../MarginlyPool.sol';

contract TimeMoveMarginlyPool is MarginlyPool {
    uint256 public blockTimestamp;

    constructor(
        address _quoteToken,
        address _baseToken,
        uint24 _uniswapFee,
        bool _quoteTokenIsToken0,
        address _uniswapPool,
        MarginlyParams memory _params,
        uint256 initialBlockTimestamp
    ) MarginlyPool(
        _quoteToken,
        _baseToken,
        _uniswapFee,
        _quoteTokenIsToken0,
        _uniswapPool,
        _params
    ) {
        lastReinitTimestampSeconds = initialBlockTimestamp;
        blockTimestamp = initialBlockTimestamp;
    }

    function getTimestamp() internal override view returns (uint256) {
        return blockTimestamp;
    }

    function setTimestamp(uint256 _blockTimestamp) external {
        require(_blockTimestamp > blockTimestamp);
        blockTimestamp = _blockTimestamp;
    }
}