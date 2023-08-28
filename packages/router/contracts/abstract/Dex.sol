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
  Woofi,
  Proxy
}

struct PoolInput {
  Dex dex;
  address token0;
  address token1;
  address pool;
}

struct DexInfo {
  Dex dex;
  address pool;
}

abstract contract DexPoolMapping is Ownable {
  error UnknownDex();
  error UnknownPool();
  error InsufficientAmount();
  error TooMuchRequested();
  error NotSupported();

  mapping(uint256 => mapping(address => mapping(address => DexInfo))) public getPool;

  constructor(PoolInput[] memory pools) {
    PoolInput memory input;
    for (uint256 i; i < pools.length; ++i) {
      input = pools[i];
      getPool[uint256(input.dex)][input.token0][input.token1] = DexInfo({dex: input.dex, pool: input.pool});
      getPool[uint256(input.dex)][input.token1][input.token0] = DexInfo({dex: input.dex, pool: input.pool});
    }
  }

  function addPools(PoolInput[] calldata pools) external onlyOwner {
    PoolInput memory input;
    for (uint256 i; i < pools.length; ++i) {
      input = pools[i];
      getPool[uint256(input.dex)][input.token0][input.token1] = DexInfo({dex: input.dex, pool: input.pool});
      getPool[uint256(input.dex)][input.token1][input.token0] = DexInfo({dex: input.dex, pool: input.pool});
    }
  }

  function getPoolSafe(uint256 id, address tokenA, address tokenB) internal view returns (address pool, Dex dex) {
    DexInfo memory dexInfo = getPool[id][tokenA][tokenB];
    pool = dexInfo.pool;
    dex = dexInfo.dex;
    if (pool == address(0)) revert UnknownPool();
  }
}
