// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

abstract contract PoolList {
  error UnknownPool();

  mapping(Dex => address) public poolList;
}

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
