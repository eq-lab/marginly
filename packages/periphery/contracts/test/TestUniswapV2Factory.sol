// // SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import './TestUniswapV2Pair.sol';

contract TestUniswapV2Factory {
  mapping(address => mapping(address => address)) public getPair;
  address[] public allPairs;

  function allPairsLength() external view returns (uint) {
    return allPairs.length;
  }

  function createPair(address tokenA, address tokenB) external returns (address pair) {
    require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');
    (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS');
    require(getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS'); // single check is sufficient

    pair = address(new TestUniswapV2Pair(token0, token1));
    getPair[token0][token1] = pair;
    getPair[token1][token0] = pair; // populate mapping in the reverse direction
    allPairs.push(pair);
  }
}
