// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import '@marginly/contracts/contracts/interfaces/IMarginlyFactory.sol';

import '@marginly/contracts/contracts/dataTypes/Position.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract MockMarginlyFactory is IMarginlyFactory {
  address public override swapRouter;

  constructor(address _swapRouter) {
    swapRouter = _swapRouter;
  }

  function createPool(
    address quoteToken,
    address baseToken,
    uint24 uniswapFee,
    MarginlyParams memory params
  ) external override returns (address pool) {
    return address(0);
  }

  function getPool(address quoteToken, address baseToken, uint24 fee) external view override returns (address pool) {
    return address(0);
  }

  /// @notice Swap fee holder address
  function feeHolder() external view override returns (address) {
    return address(0);
  }

  function owner() external view override returns (address) {}

  function setOwner(address _owner) external {}
}
