// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';

import '@openzeppelin/contracts/access/Ownable2Step.sol';

import './interfaces/IMarginlyFactory.sol';
import './dataTypes/MarginlyParams.sol';
import './libraries/Errors.sol';

import './FullMarginlyPool.sol';

/// @title Marginly contract factory
/// @notice Deploys Marginly and manages ownership and control over pool
contract FullMarginlyFactory is IMarginlyFactory, Ownable2Step {
  /// @notice Address of uniswap factory
  address public immutable uniswapFactory;
  /// @notice Address of uniswap swap router
  address public override swapRouter;
  /// @notice Swap fee holder
  address public immutable override feeHolder;
  /// @notice Address of wrapped ETH
  address public immutable override WETH9;
  /// @notice Technical position address
  address public immutable override techPositionOwner;

  /// @inheritdoc IMarginlyFactory
  mapping(address => mapping(address => mapping(uint24 => address))) public override getPool;

  constructor(
    address _uniswapFactory,
    address _swapRouter,
    address _feeHolder,
    address _WETH9,
    address _techPositionOwner
  ) {
    if (
      _uniswapFactory == address(0) ||
      _swapRouter == address(0) ||
      _feeHolder == address(0) ||
      _WETH9 == address(0) ||
      _techPositionOwner == address(0)
    ) revert Errors.WrongValue();

    uniswapFactory = _uniswapFactory;
    swapRouter = _swapRouter;
    feeHolder = _feeHolder;
    WETH9 = _WETH9;
    techPositionOwner = _techPositionOwner;
  }

  /// @inheritdoc IMarginlyFactory
  function createPool(
    address quoteToken,
    address baseToken,
    uint24 uniswapFee,
    MarginlyParams calldata params
  ) external override onlyOwner returns (address pool) {
    if (quoteToken == baseToken) revert Errors.Forbidden();

    address existingPool = getPool[quoteToken][baseToken][uniswapFee];
    if (existingPool != address(0)) revert Errors.PoolAlreadyCreated();
    address uniswapPool = IUniswapV3Factory(uniswapFactory).getPool(quoteToken, baseToken, uniswapFee);
    if (uniswapPool == address(0)) revert Errors.UniswapPoolNotFound();

    // https://github.com/Uniswap/v3-core/blob/main/contracts/UniswapV3Factory.sol#L41
    bool quoteTokenIsToken0 = quoteToken < baseToken;

    pool = address(
      new FullMarginlyPool{salt: keccak256(abi.encode(uniswapPool))}(
        quoteToken,
        baseToken,
        quoteTokenIsToken0,
        uniswapPool,
        params
      )
    );

    getPool[quoteToken][baseToken][uniswapFee] = pool;
    getPool[baseToken][quoteToken][uniswapFee] = pool;
    emit PoolCreated(quoteToken, baseToken, uniswapPool, quoteTokenIsToken0, pool);
  }

  /// @inheritdoc IMarginlyFactory
  function changeSwapRouter(address newSwapRouter) external onlyOwner {
    if (newSwapRouter == address(0)) revert Errors.WrongValue();
    swapRouter = newSwapRouter;
    emit SwapRouterChanged(newSwapRouter);
  }

  function renounceOwnership() public override onlyOwner {
    revert Errors.Forbidden();
  }
}
