// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import './interfaces/IMarginlyPool.sol';
import './interfaces/IMarginlyPoolWrapper.sol';
import './libraries/FP96.sol';

contract MarginlyPoolWrapper is IMarginlyPoolWrapper {
  /// @dev Marginly pool address to work with
  mapping (address => bool) public whitelistedMarginlyPools;
  /// @dev reentrancy guard
  bool public unlocked;
  /// @dev contract admin
  address public admin;

  constructor(address[] memory marginlyPoolAddresses, address _admin) {
    for(uint256 index = 0; index < marginlyPoolAddresses.length; ++index) {
      whitelistedMarginlyPools[marginlyPoolAddresses[index]] = true;
    }
    unlocked = true;
    admin = _admin;
  }

  function _lock() private view {
    require(unlocked, 'LOK'); // Locked for reentrant call
  }

  /// @dev Protects against reentrancy
  modifier lock() {
    _lock();
    unlocked = false;
    _;
    unlocked = true;
  }

  function _onlyAdminOrManager() private view {
    require(msg.sender == admin, 'AD'); // Access denied
  }

  modifier onlyAdminOrManager() {
    _onlyAdminOrManager();
    _;
  }

  /// @inheritdoc IMarginlyPoolWrapper
  function long(address marginlyPoolAddress, uint256 depositBaseAmount, uint256 longBaseAmount) external lock {
    require(whitelistedMarginlyPools[marginlyPoolAddress], 'NW'); // not whitelisted
    IMarginlyPool marginlyPool = IMarginlyPool(marginlyPoolAddress);
    address baseToken = marginlyPool.baseToken();
    TransferHelper.safeTransferFrom(baseToken, msg.sender, address(this), depositBaseAmount);
    TransferHelper.safeApprove(baseToken, marginlyPoolAddress, depositBaseAmount);
    marginlyPool.depositBase(depositBaseAmount);
    marginlyPool.long(longBaseAmount);
    marginlyPool.transferPosition(msg.sender);
  }

  /// @inheritdoc IMarginlyPoolWrapper
  function short(address marginlyPoolAddress, uint256 depositQuoteAmount, uint256 shortBaseAmount) external lock {
    require(whitelistedMarginlyPools[marginlyPoolAddress], 'NW'); // not whitelisted
    IMarginlyPool marginlyPool = IMarginlyPool(marginlyPoolAddress);
    address quoteToken = marginlyPool.quoteToken();
    TransferHelper.safeTransferFrom(quoteToken, msg.sender, address(this), depositQuoteAmount);
    TransferHelper.safeApprove(quoteToken, marginlyPoolAddress, depositQuoteAmount);
    marginlyPool.depositQuote(depositQuoteAmount);
    marginlyPool.short(shortBaseAmount);
    marginlyPool.transferPosition(msg.sender);
  }

  function addPoolAddress(address newPool) external onlyAdminOrManager {
    whitelistedMarginlyPools[newPool] = true;
  }

  function deletePoolAddress(address poolToDelete) external onlyAdminOrManager {
    delete whitelistedMarginlyPools[poolToDelete];
  }
}