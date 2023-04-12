// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import './interfaces/IMarginlyPool.sol';
import './interfaces/IMarginlyPoolWrapper.sol';
import './libraries/FP96.sol';

contract MarginlyPoolWrapper is IMarginlyPoolWrapper {
  /// @dev Marginly pool address to work with
  address[] public marginlyPoolAddresses;
  /// @dev reentrancy guard
  bool public unlocked;
  /// @dev contract admin
  address public admin;

  constructor(address[] memory _marginlyPoolAddresses, address _admin) {
    marginlyPoolAddresses = _marginlyPoolAddresses;
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
  function long(uint32 poolIndex, uint256 depositBaseAmount, uint256 longBaseAmount) external lock {
    address marginlyPoolAddress = marginlyPoolAddresses[poolIndex];
    IMarginlyPool marginlyPool = IMarginlyPool(marginlyPoolAddress);
    address baseToken = marginlyPool.baseToken();
    TransferHelper.safeTransferFrom(baseToken, msg.sender, address(this), depositBaseAmount);
    TransferHelper.safeApprove(baseToken, marginlyPoolAddress, depositBaseAmount);
    marginlyPool.depositBase(depositBaseAmount);
    marginlyPool.long(longBaseAmount);
    marginlyPool.transferPosition(msg.sender);
  }

  /// @inheritdoc IMarginlyPoolWrapper
  function short(uint32 poolIndex, uint256 depositQuoteAmount, uint256 shortBaseAmount) external lock {
    address marginlyPoolAddress = marginlyPoolAddresses[poolIndex];
    IMarginlyPool marginlyPool = IMarginlyPool(marginlyPoolAddress);
    address quoteToken = marginlyPool.quoteToken();
    TransferHelper.safeTransferFrom(quoteToken, msg.sender, address(this), depositQuoteAmount);
    TransferHelper.safeApprove(quoteToken, marginlyPoolAddress, depositQuoteAmount);
    marginlyPool.depositQuote(depositQuoteAmount);
    marginlyPool.short(shortBaseAmount);
    marginlyPool.transferPosition(msg.sender);
  }

  function addNewPoolAddress(address newPool) external onlyAdminOrManager {
    marginlyPoolAddresses.push(newPool);
  }

  function popPoolAddress(uint32 index) external onlyAdminOrManager {
    uint256 arrayLastIndex = marginlyPoolAddresses.length - 1;
    for (uint32 i = index; i < arrayLastIndex; i++) {
      marginlyPoolAddresses[i] = marginlyPoolAddresses[i + 1];
    }
    delete marginlyPoolAddresses[arrayLastIndex];
  }
}