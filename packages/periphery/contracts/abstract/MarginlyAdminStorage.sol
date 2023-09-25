// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@marginly/contracts/contracts/libraries/Errors.sol';

abstract contract MarginlyPoolAdminStorage {
  /// @dev Mapping of Marginly pool address as key and pool owner as value
  mapping(address => address) public poolsOwners;
  /// @dev Address of Marginly factory
  address public immutable marginlyFactoryAddress;
  /// @dev UniswapV3 adapter index in Marginly router storage
  uint256 public constant UNISWAPV3_ADAPTER_INDEX = 0;

  error InvalidUnderlyingPool();

  constructor(address marginlyFactory) {
    if (marginlyFactory == address(0)) revert Errors.Forbidden();
    marginlyFactoryAddress = marginlyFactory;
  }
}
