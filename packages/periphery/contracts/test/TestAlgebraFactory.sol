// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface IAlgebraPool {
  function token0() external view returns (address);

  function token1() external view returns (address);
}

contract TestAlgebraFactory {
  mapping(address => mapping(address => address)) public pools;

  function addPool(address pool) external {
    IAlgebraPool algebraPool = IAlgebraPool(pool);
    address token0 = algebraPool.token0();
    address token1 = algebraPool.token1();

    pools[token0][token1] = pool;
    pools[token1][token0] = pool;
  }

  function poolByPair(address tokenA, address tokenB) external view returns (address pool) {
    pool = pools[tokenA][tokenB];
  }
}
