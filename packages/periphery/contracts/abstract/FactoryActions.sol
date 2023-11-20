// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@marginly/contracts/contracts/interfaces/IMarginlyFactory.sol';

import './MarginlyAdminStorage.sol';

abstract contract FactoryActions is MarginlyAdminStorage, Ownable2Step {
  /// @dev changes Marginly factory SwapRouter address
  /// @param newSwapRouter address of new swap router
  function changeSwapRouter(address newSwapRouter) external onlyOwner {
    IMarginlyFactory(marginlyFactoryAddress).changeSwapRouter(newSwapRouter);
  }

  /// @dev Set a new owner of a Marginly factory contract. Allowed only for MarginlyPoolAdmin owner
  /// @param to Address of a new Marginly factory owner
  function transferMarginlyFactoryOwnership(address to) external onlyOwner {
    Ownable2Step(marginlyFactoryAddress).transferOwnership(to);
  }

  /// @dev Accepts Marginly factory contract ownership
  function acceptMarginlyFactoryOwnership() external onlyOwner {
    Ownable2Step(marginlyFactoryAddress).acceptOwnership();
  }
}
