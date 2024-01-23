// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import "./UniswapV3PoolMock.sol";

contract TestUniswapV3PoolMock is UniswapV3PoolMock {
    uint256 timestamp;

    constructor(
      address oracle, 
      address tokenA, 
      address tokenB, 
      uint24 _fee
    ) UniswapV3PoolMock(msg.sender, oracle, tokenA, tokenB, _fee) {

    }

    function _blockTimestamp() internal override view returns (uint32) {
        return uint32(timestamp); // truncation is desired
    }

    function setTimestamp(uint256 _timestamp) external {
        timestamp = _timestamp;
    }
}