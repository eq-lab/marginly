// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import './interfaces/IMarginlyPool.sol';
import './interfaces/IMarginlyPoolWrapper.sol';
import './libraries/FP96.sol';

contract MarginlyPoolWrapper is IMarginlyPoolWrapper {
  /// @dev Marginly pool address to work with
  address public marginlyPoolAddress;
  /// @dev reentrancy guard
  bool public unlocked;

  constructor(address _marginlyPoolAddress) {
    marginlyPoolAddress = _marginlyPoolAddress;
    unlocked = true;
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

  /// @inheritdoc IMarginlyPoolWrapper
  function long(uint256 depositBaseAmount, uint256 longBaseAmount) external lock {
    IMarginlyPool marginlyPool = IMarginlyPool(marginlyPoolAddress);
    address baseToken = marginlyPool.baseToken();
    TransferHelper.safeTransferFrom(baseToken, msg.sender, address(this), depositBaseAmount);
    TransferHelper.safeApprove(baseToken, marginlyPoolAddress, depositBaseAmount);
    marginlyPool.depositBase(depositBaseAmount);
    marginlyPool.long(longBaseAmount);
    marginlyPool.transferPosition(msg.sender);
  }

  /// @inheritdoc IMarginlyPoolWrapper
  function short(uint256 depositQuoteAmount, uint256 shortBaseAmount) external lock {
    IMarginlyPool marginlyPool = IMarginlyPool(marginlyPoolAddress);
    address quoteToken = marginlyPool.quoteToken();
    TransferHelper.safeTransferFrom(quoteToken, msg.sender, address(this), depositQuoteAmount);
    TransferHelper.safeApprove(quoteToken, marginlyPoolAddress, depositQuoteAmount);
    marginlyPool.depositQuote(depositQuoteAmount);
    marginlyPool.short(shortBaseAmount);
    marginlyPool.transferPosition(msg.sender);
  }
}