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

struct ConstructorInput {
  Dex dex;
  uint24 fee;
  address token0;
  address token1;
  address pool;
}

struct PoolInfo {
  uint24 fee;
  address pool;
}

abstract contract DexPoolMapping {
  error UnknownPool();

  constructor(ConstructorInput[] memory pools) {
    ConstructorInput memory input;
    for(uint256 i = 0; i < pools.length; ++i) {
      input = pools[i];
      dexPoolMapping[input.dex][input.token0][input.token1] = PoolInfo({fee: input.fee, pool: input.pool});
      dexPoolMapping[input.dex][input.token1][input.token0] = PoolInfo({fee: input.fee, pool: input.pool});
    }
  }

  mapping(Dex => mapping(address => mapping(address => PoolInfo))) public dexPoolMapping;
}
