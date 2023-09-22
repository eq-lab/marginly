// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable2Step.sol';

import '../interfaces/IMarginlyAdapter.sol';

struct PoolInput {
  address token0;
  address token1;
  address pool;
}

abstract contract AdapterStorage is IMarginlyAdapter, Ownable2Step {
  error UnknownPool();

  mapping(address => mapping(address => address)) public getPool;

  constructor(PoolInput[] memory pools) {
    PoolInput memory input;
    for (uint256 i; i < pools.length; ++i) {
      input = pools[i];
      getPool[input.token0][input.token1] = input.pool;
      getPool[input.token1][input.token0] = input.pool;
    }
  }

  function addPools(PoolInput[] calldata pools) external onlyOwner {
    PoolInput memory input;
    for (uint256 i; i < pools.length; ++i) {
      input = pools[i];
      getPool[input.token0][input.token1] = input.pool;
      getPool[input.token1][input.token0] = input.pool;
    }
  }

  function getPoolSafe(address tokenA, address tokenB) internal view returns (address pool) {
    pool = getPool[tokenA][tokenB];
    if (pool == address(0)) revert UnknownPool();
  }
}
