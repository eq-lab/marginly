// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@marginly/contracts/contracts/interfaces/IMarginlyFactory.sol';
import '@marginly/contracts/contracts/libraries/Errors.sol';
import '@marginly/router/contracts/MarginlyRouter.sol';
import '@marginly/router/contracts/abstract/AdapterStorage.sol';

import './MarginlyAdminStorage.sol';

abstract contract AdapterActions is MarginlyAdminStorage {
  /// @dev Add pools to router adapter storage. Allowed only for MarginlyPoolAdmin owner
  /// @param pools New pool parameters
  function addPools(PoolInput[] calldata pools) external onlyOwner {
    address marginlyRouterAddress = IMarginlyFactory(marginlyFactoryAddress).swapRouter();
    if (marginlyRouterAddress == address(0)) revert Errors.Forbidden();
    address adapterAddress = MarginlyRouter(marginlyRouterAddress).adapters(UNISWAPV3_ADAPTER_INDEX);
    if (adapterAddress == address(0)) revert Errors.Forbidden();

    AdapterStorage adapterStorage = AdapterStorage(adapterAddress);
    adapterStorage.addPools(pools);
  }

  /// @dev Set a new owner of a Marginly router adapter contract. Allowed only for MarginlyPoolAdmin owner
  /// @param dexIdx Index of a dex
  /// @param to Address of a new Marginly router adapter owner
  function transferRouterAdapterOwnership(uint256 dexIdx, address to) external onlyOwner {
    MarginlyRouter marginlyRouter = MarginlyRouter(IMarginlyFactory(marginlyFactoryAddress).swapRouter());
    address adapterAddress = marginlyRouter.adapters(dexIdx);
    if (adapterAddress == address(0)) revert Errors.Forbidden();
    AdapterStorage(adapterAddress).transferOwnership(to);
  }

  /// @dev Accepts ownership of adapter. Needed for new pools addition
  /// @param dexIdx Index of a dex
  function acceptRouterAdapterOwnership(uint256 dexIdx) external onlyOwner {
    MarginlyRouter marginlyRouter = MarginlyRouter(IMarginlyFactory(marginlyFactoryAddress).swapRouter());
    address adapterAddress = marginlyRouter.adapters(dexIdx);
    if (adapterAddress == address(0)) revert Errors.Forbidden();
    Ownable2Step(adapterAddress).acceptOwnership();
  }
}
