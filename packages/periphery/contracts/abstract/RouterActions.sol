// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@marginly/contracts/contracts/interfaces/IMarginlyFactory.sol';
import '@marginly/router/contracts/MarginlyRouter.sol';

import './MarginlyAdminStorage.sol';

abstract contract RouterActions is MarginlyPoolAdminStorage, Ownable2Step {
  /// @dev Set a new owner of a Marginly router contract. Allowed only for MarginlyPoolAdmin owner
  /// @param to Address of a new Marginly router owner
  function transferMarginlyRouterOwnership(address to) external onlyOwner {
    MarginlyRouter(IMarginlyFactory(marginlyFactoryAddress).swapRouter()).transferOwnership(to);
  }

  /// @dev Accepts Marginly router contract ownership
  function acceptMarginlyRouterOwnership() external onlyOwner {
    Ownable2Step(IMarginlyFactory(marginlyFactoryAddress).swapRouter()).acceptOwnership();
  }
}
