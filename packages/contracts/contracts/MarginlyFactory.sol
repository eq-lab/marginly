// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@openzeppelin/contracts/proxy/Clones.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';

import './interfaces/IMarginlyFactory.sol';
import './interfaces/IPriceOracle.sol';
import './dataTypes/MarginlyParams.sol';
import './libraries/Errors.sol';

import './MarginlyPool.sol';

/// @title Marginly contract factory
/// @notice Deploys Marginly and manages ownership and control over pool
contract MarginlyFactory is IMarginlyFactory, Ownable2Step {
  address public immutable marginlyPoolImplementation;
  /// @notice Address of uniswap swap router
  address public override swapRouter;
  /// @notice Swap fee holder
  address public immutable override feeHolder;
  /// @notice Address of wrapped ETH
  address public immutable override WETH9;
  /// @notice Technical position address
  address public immutable override techPositionOwner;
  /// @notice Map that contains all pools created by factory
  mapping(address => bool) public override isPoolExists;

  constructor(
    address _marginlyPoolImplementation,
    address _swapRouter,
    address _feeHolder,
    address _WETH9,
    address _techPositionOwner
  ) {
    if (
      _marginlyPoolImplementation == address(0) ||
      _swapRouter == address(0) ||
      _feeHolder == address(0) ||
      _WETH9 == address(0) ||
      _techPositionOwner == address(0)
    ) revert Errors.WrongValue();

    marginlyPoolImplementation = _marginlyPoolImplementation;
    swapRouter = _swapRouter;
    feeHolder = _feeHolder;
    WETH9 = _WETH9;
    techPositionOwner = _techPositionOwner;
  }

  /// @inheritdoc IMarginlyFactory
  function createPool(
    address quoteToken,
    address baseToken,
    address priceOracle,
    uint32 defaultSwapCallData,
    MarginlyParams calldata params
  ) external override onlyOwner returns (address pool) {
    if (quoteToken == baseToken) revert Errors.Forbidden();
    if (priceOracle == address(0)) revert Errors.WrongValue();

    pool = Clones.clone(marginlyPoolImplementation);
    IMarginlyPool(pool).initialize(quoteToken, baseToken, priceOracle, defaultSwapCallData, params);
    isPoolExists[pool] = true;

    emit PoolCreated(quoteToken, baseToken, priceOracle, defaultSwapCallData, pool);
  }

  /// @inheritdoc IMarginlyFactory
  function changeSwapRouter(address newSwapRouter) external onlyOwner {
    if (newSwapRouter == address(0)) revert Errors.WrongValue();
    swapRouter = newSwapRouter;
    emit SwapRouterChanged(newSwapRouter);
  }

  function renounceOwnership() public view override onlyOwner {
    revert Errors.Forbidden();
  }
}
