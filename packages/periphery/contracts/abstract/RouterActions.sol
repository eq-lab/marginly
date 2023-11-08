// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@marginly/contracts/contracts/interfaces/IMarginlyFactory.sol';
import '@marginly/router/contracts/MarginlyRouter.sol';

import './MarginlyAdminStorage.sol';

abstract contract RouterActions is MarginlyAdminStorage, Ownable2Step {
  /// @dev add dex adapters to router
  /// @param _adapters input to MarginlyRouter `addDexAdapters` call
  function addDexAdapters(AdapterInput[] calldata _adapters) external onlyOwner {
    MarginlyRouter(getSwapRouterAddressSafe()).addDexAdapters(_adapters);
  }

  /// @dev Set a new owner of a Marginly router contract. Allowed only for MarginlyPoolAdmin owner
  /// @param to Address of a new Marginly router owner
  function transferMarginlyRouterOwnership(address to) external onlyOwner {
    MarginlyRouter(getSwapRouterAddressSafe()).transferOwnership(to);
  }

  /// @dev Accepts Marginly router contract ownership
  function acceptMarginlyRouterOwnership() external onlyOwner {
    Ownable2Step(getSwapRouterAddressSafe()).acceptOwnership();
  }

  /// @dev returns swap router address from factory. Reverts in case of null address
  function getSwapRouterAddressSafe() private view returns (address swapRouter) {
    swapRouter = IMarginlyFactory(marginlyFactoryAddress).swapRouter();
    if (swapRouter == address(0)) revert Errors.Forbidden();
  }
}
