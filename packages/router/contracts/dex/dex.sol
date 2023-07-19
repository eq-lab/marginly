// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

enum Dex {
  UniswapV3,
  ApeSwap,
  Balancer,
  Camelot,
  KyberSwap,
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

abstract contract DexPoolMapping {
  error UnknownPool();

  mapping(Dex => mapping(address => mapping(address => address))) public dexPoolMapping;

  constructor(PoolInput[] memory pools) {
    PoolInput memory input;
    for (uint256 i = 0; i < pools.length; ++i) {
      input = pools[i];
      dexPoolMapping[input.dex][input.token0][input.token1] = input.pool;
      dexPoolMapping[input.dex][input.token1][input.token0] = input.pool;
    }
  }

  function addPools(PoolInput[] memory pools) external {
    PoolInput memory input;
    for (uint256 i = 0; i < pools.length; ++i) {
      input = pools[i];
      dexPoolMapping[input.dex][input.token0][input.token1] = input.pool;
      dexPoolMapping[input.dex][input.token1][input.token0] = input.pool;
    }
  }
}
