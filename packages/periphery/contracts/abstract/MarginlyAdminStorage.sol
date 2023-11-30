// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@marginly/contracts/contracts/libraries/Errors.sol';
import '@marginly/contracts/contracts/interfaces/IMarginlyFactory.sol';

abstract contract MarginlyAdminStorage is Ownable2Step {
  /// @dev Mapping of Marginly pool address as key and pool owner as value
  mapping(address => address) public poolsOwners;
  /// @dev Address of Marginly factory
  address public immutable marginlyFactoryAddress;
  /// @dev UniswapV3 adapter index in Marginly router storage
  uint256 public constant UNISWAPV3_ADAPTER_INDEX = 0;

  error InvalidUnderlyingPool();
  error NonExistentPool();

  /// @dev emitted when the new pool is added or the old one changes owner
  event NewPoolOwner(address indexed pool, address indexed newOwner);

  constructor(address marginlyFactory) {
    if (marginlyFactory == address(0)) revert Errors.Forbidden();
    marginlyFactoryAddress = marginlyFactory;
  }

  /// @dev adds previously deployed missing pool to storage
  function setPoolOwnership(address poolBaseToken, address poolQuoteToken, uint24 fee) external onlyOwner {
    address poolAddress = IMarginlyFactory(marginlyFactoryAddress).getPool(poolBaseToken, poolQuoteToken, fee);
    if (poolAddress == address(0)) revert NonExistentPool();
    if (poolsOwners[poolAddress] != address(0)) revert Errors.Forbidden();
    poolsOwners[poolAddress] = msg.sender;
    emit NewPoolOwner(poolAddress, msg.sender);
  }

  function renounceOwnership() public view override onlyOwner {
    revert Errors.Forbidden();
  }
}
