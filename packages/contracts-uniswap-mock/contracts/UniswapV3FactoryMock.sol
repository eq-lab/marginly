// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import './NoDelegateCall.sol';
import './UniswapV3PoolMock.sol';

contract UniswapV3FactoryMock is NoDelegateCall {
  address public owner;

  mapping(uint24 => int24) public feeAmountTickSpacing;
  mapping(address => mapping(address => mapping(uint24 => address))) public getPool;

  event PoolCreated(address indexed token0, address indexed token1, uint24 fee, address indexed pool);

  constructor() {
    owner = msg.sender;
  }

  function createPool(
    address oracle,
    address tokenA,
    address tokenB,
    uint24 fee
  ) external noDelegateCall returns (address pool) {
    require(tokenA != tokenB);
    (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0));
    require(getPool[token0][token1][fee] == address(0));
    pool = deploy(oracle, token0, token1, fee);
    getPool[token0][token1][fee] = pool;
    getPool[token1][token0][fee] = pool;
    emit PoolCreated(token0, token1, fee, pool);
  }

  function deploy(address oracle, address token0, address token1, uint24 fee) private returns (address pool) {
    pool = address(
      new UniswapV3PoolMock{salt: keccak256(abi.encode(token0, token1, fee))}(msg.sender, oracle, token0, token1, fee)
    );
  }
}
