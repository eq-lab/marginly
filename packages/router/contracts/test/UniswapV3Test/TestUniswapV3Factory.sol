// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolImmutables.sol';
import './TestUniswapV3Pool.sol';

struct Parameters {
  address factory;
  address token0;
  address token1;
  uint24 fee;
  int24 tickSpacing;
}

/// @dev Stub of UniswapFactory
contract RouterTestUniswapV3Factory is IUniswapV3Factory {
  event TestPoolCreated(address pool);
  address public override owner;
  mapping(uint24 => int24) public override feeAmountTickSpacing;
  mapping(address => mapping(address => mapping(uint24 => address))) public override getPool;

  constructor() {
    owner = msg.sender;
    feeAmountTickSpacing[0] = 0;
    feeAmountTickSpacing[500] = 10;
    feeAmountTickSpacing[3000] = 60;
    feeAmountTickSpacing[10000] = 200;
  }

  function createPool(address tokenA, address tokenB, uint24 fee) external override returns (address pool) {
    (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    int24 tickSpacing = feeAmountTickSpacing[fee];
    pool = deploy(address(this), token0, token1, fee, tickSpacing);
    getPool[token0][token1][fee] = pool;
    getPool[token1][token0][fee] = pool;
  }

  function deploy(
    address factory,
    address token0,
    address token1,
    uint24 fee,
    int24 tickSpacing
  ) private returns (address pool) {
    // parameters = Parameters({factory: factory, token0: token0, token1: token1, fee: fee, tickSpacing: tickSpacing});
    pool = address(new RouterTestUniswapV3Pool{salt: keccak256(abi.encode(token0, token1, fee))}(token0, token1));
    emit TestPoolCreated(pool);
    // delete parameters;
  }

  function setOwner(address) external pure override {
    revert('not implemented');
  }

  function enableFeeAmount(uint24, int24) external pure override {
    revert('not implemented');
  }
}
