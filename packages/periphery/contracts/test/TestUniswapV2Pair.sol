// // SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

contract TestUniswapV2Pair {
  uint112 public reserve0;
  uint112 public reserve1;
  uint32 public blockTimestampLast;

  uint256 public price0CumulativeLast;
  uint256 public price1CumulativeLast;

  address public token0;
  address public token1;

  constructor(address _token0, address _token1) {
    token0 = _token0;
    token1 = _token1;
  }

  function setPriceCumulatives(uint256 _price0Cumulative, uint256 _price1Cumulative) external {
    price0CumulativeLast = _price0Cumulative;
    price1CumulativeLast = _price1Cumulative;
  }

  function setReserves(uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestamp) external {
    reserve0 = _reserve0;
    reserve1 = _reserve1;
    blockTimestampLast = _blockTimestamp;
  }

  function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
    _reserve0 = reserve0;
    _reserve1 = reserve1;
    _blockTimestampLast = blockTimestampLast;
  }
}
