// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/IMarginlyFactory.sol';

import '../dataTypes/Position.sol';

contract MockMarginlyFactory is IMarginlyFactory {
  address public override swapRouter;

  mapping(address => bool) public override isPoolExists;

  constructor(address _swapRouter) {
    swapRouter = _swapRouter;
  }

  function createPool(
    address,
    address,
    address,
    uint32,
    MarginlyParams memory
  ) external pure override returns (address pool) {
    return address(0);
  }

  function changeSwapRouter(address newSwapRouter) external {}

  /// @notice Swap fee holder address
  function feeHolder() external pure override returns (address) {
    return address(0);
  }

  function WETH9() external view override returns (address) {}

  function techPositionOwner() external view returns (address) {}
}
