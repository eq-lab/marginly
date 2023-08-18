// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';

enum Dex {
  UniswapV3,
  ApeSwap,
  Balancer,
  Camelot,
  KyberClassicSwap,
  KyberElasticSwap,
  QuickSwap,
  SushiSwap,
  TraderJoe,
  Woofi
}

struct PoolInput {
  Dex dex;
  address token0;
  address token1;
  address pool;
}

abstract contract DexPoolMapping is Ownable {
  error UnknownDex();
  error UnknownPool();
  error InsufficientAmount();
  error TooMuchRequested();
  error NotSupported();

  mapping(Dex => mapping(address => mapping(address => address))) public getPool;

  constructor(PoolInput[] memory pools) {
    PoolInput memory input;
    for (uint256 i; i < pools.length; ++i) {
      input = pools[i];
      getPool[input.dex][input.token0][input.token1] = input.pool;
      getPool[input.dex][input.token1][input.token0] = input.pool;
    }
  }

  function addPools(PoolInput[] calldata pools) external onlyOwner {
    PoolInput memory input;
    for (uint256 i; i < pools.length; ++i) {
      input = pools[i];
      getPool[input.dex][input.token0][input.token1] = input.pool;
      getPool[input.dex][input.token1][input.token0] = input.pool;
    }
  }

  function getPoolSafe(Dex dex, address tokenA, address tokenB) internal view returns (address pool) {
    pool = getPool[dex][tokenA][tokenB];
    if (pool == address(0)) revert UnknownPool();
  }
}
