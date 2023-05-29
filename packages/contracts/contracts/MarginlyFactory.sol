// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@openzeppelin/contracts/proxy/Clones.sol';

import './interfaces/IMarginlyFactory.sol';
import './dataTypes/MarginlyParams.sol';

import './MarginlyPool.sol';

/// @title Marginly contract factory
/// @notice Deploys Marginly and manages ownership and control over pool
contract MarginlyFactory is IMarginlyFactory {
  address public marginlyPoolImplementation;
  /// @inheritdoc IOwnable
  address public override owner;
  /// @notice Address of uniswap factory
  address public uniswapFactory;
  /// @notice Address of uniswap swap router
  address public override swapRouter;
  /// @notice Swap fee holder
  address public override feeHolder;
  /// @notice Address of wrapped ETH
  address public override WETH9;
  /// @notice Technical position address
  address public override techPositionOwner;

  /// @inheritdoc IMarginlyFactory
  mapping(address => mapping(address => mapping(uint24 => address))) public override getPool;

  constructor(
    address _marginlyPoolImplementation,
    address _uniswapFactory,
    address _swapRouter,
    address _feeHolder,
    address _WETH9,
    address _techPositionOwner
  ) {
    owner = msg.sender;
    emit OwnerChanged(address(0), msg.sender);

    marginlyPoolImplementation = _marginlyPoolImplementation;
    uniswapFactory = _uniswapFactory;
    swapRouter = _swapRouter;
    feeHolder = _feeHolder;
    WETH9 = _WETH9;
    techPositionOwner = _techPositionOwner;
  }

  /// @inheritdoc IOwnable
  function setOwner(address _owner) external override {
    require(msg.sender == owner, 'NO'); // Not an owner
    owner = _owner;
    emit OwnerChanged(owner, _owner);
  }

  /// @inheritdoc IMarginlyFactory
  function createPool(
    address quoteToken,
    address baseToken,
    uint24 uniswapFee,
    MarginlyParams calldata params
  ) external override returns (address pool) {
    require(msg.sender == owner, 'NO'); // Not an owner
    require(quoteToken != baseToken);

    address existingPool = getPool[quoteToken][baseToken][uniswapFee];
    require(existingPool == address(0), 'PC'); // Pool already created

    address uniswapPool = IUniswapV3Factory(uniswapFactory).getPool(quoteToken, baseToken, uniswapFee);
    require(uniswapPool != address(0), 'UNF'); // Uniswap pool not found

    bool quoteTokenIsToken0 = quoteToken == IUniswapV3Pool(uniswapPool).token0();

    pool = Clones.cloneDeterministic(marginlyPoolImplementation, keccak256(abi.encode(uniswapPool)));
    IMarginlyPool(pool).initialize(quoteToken, baseToken, uniswapFee, quoteTokenIsToken0, uniswapPool, params);

    getPool[quoteToken][baseToken][uniswapFee] = pool;
    getPool[baseToken][quoteToken][uniswapFee] = pool;
    emit PoolCreated(quoteToken, baseToken, uniswapPool, quoteTokenIsToken0, pool);
  }
}
