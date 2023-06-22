// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolImmutables.sol';

/// @dev Stub of UniswapFactory
contract RouterTestUniswapFactory is IUniswapV3Factory {
  mapping(address => mapping(address => mapping(uint24 => address))) public override getPool;

  function addPool(address pool) external {
    IUniswapV3PoolImmutables uniswapPool = IUniswapV3PoolImmutables(pool);
    address token0 = uniswapPool.token0();
    address token1 = uniswapPool.token1();
    uint24 fee = uniswapPool.fee();

    getPool[token0][token1][fee] = pool;
    getPool[token1][token0][fee] = pool;
  }

  function owner() external view override returns (address) {
    return address(this);
  }

  function feeAmountTickSpacing(uint24) external pure override returns (int24) {
    revert('not implemented');
  }

  function createPool(address, address, uint24) external pure override returns (address) {
    revert('not implemented');
  }

  function setOwner(address) external pure override {
    revert('not implemented');
  }

  function enableFeeAmount(uint24, int24) external pure override {
    revert('not implemented');
  }
}
