// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';

///@dev Mock of UniswapV3Factory
contract TestUniswapV3Factory is IUniswapV3Factory {
  mapping(address => mapping(address => mapping(uint24 => address))) public pools;

  address public override owner;

  struct Pool {
    address pool;
    address tokenA;
    address tokenB;
    uint24 fee;
  }

  constructor(Pool[] memory _pools) {
    owner = msg.sender;

    uint256 length = _pools.length;
    Pool memory input;
    for (uint256 i; i < length; ) {
      input = _pools[i];

      pools[input.tokenA][input.tokenB][input.fee] = input.pool;
      pools[input.tokenB][input.tokenA][input.fee] = input.pool;

      unchecked {
        ++i;
      }
    }
  }

  function feeAmountTickSpacing(uint24) external pure override returns (int24) {
    return 0;
  }

  function getPool(address tokenA, address tokenB, uint24 fee) external view override returns (address pool) {
    pool = pools[tokenA][tokenB][fee];
  }

  function createPool(address, address, uint24) external pure returns (address) {
    require(false, 'Not implemented');
  }

  function setOwner(address) external pure override {
    require(false, 'Not implemented');
  }

  function enableFeeAmount(uint24, int24) external pure override {
    require(false, 'Not implemented');
  }
}
