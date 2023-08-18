// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/IMarginlyFactory.sol';

import '../dataTypes/Position.sol';

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

  function changeSwapRouter(address newSwapRouter) external {}

  function getPool(address quoteToken, address baseToken, uint24 fee) external view override returns (address pool) {
    return address(0);
  }

  /// @notice Swap fee holder address
  function feeHolder() external view override returns (address) {
    return address(0);
  }

  function owner() external view override returns (address) {}

  function setOwner(address _owner) external {}

  function WETH9() external view override returns (address) {}

  function techPositionOwner() external view returns (address) {}
}
