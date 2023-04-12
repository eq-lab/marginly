// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import './interfaces/IMarginlyPool.sol';
import './interfaces/IMarginlyPoolWrapper.sol';
import './libraries/FP96.sol';

contract MarginlyPoolWrapper is IMarginlyPoolWrapper {
  /// @dev Marginly pool address to work with
  address public marginlyPool;
  /// @dev reentrancy guard
  bool public unlocked;

  constructor(address _marginlyPool) {
    marginlyPool = _marginlyPool;
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
    address baseToken = IMarginlyPool(marginlyPool).baseToken();
    TransferHelper.safeTransferFrom(baseToken, msg.sender, address(this), depositBaseAmount);
    TransferHelper.safeApprove(baseToken, marginlyPool, depositBaseAmount);
    IMarginlyPool(marginlyPool).depositBase(depositBaseAmount);
    IMarginlyPool(marginlyPool).long(longBaseAmount);
    IMarginlyPool(marginlyPool).transferPosition(msg.sender);
  }

  /// @inheritdoc IMarginlyPoolWrapper
  function short(uint256 depositQuoteAmount, uint256 shortBaseAmount) external lock {
    address quoteToken = IMarginlyPool(marginlyPool).quoteToken();
    TransferHelper.safeTransferFrom(quoteToken, msg.sender, address(this), depositQuoteAmount);
    TransferHelper.safeApprove(quoteToken, marginlyPool, depositQuoteAmount);
    IMarginlyPool(marginlyPool).depositQuote(depositQuoteAmount);
    IMarginlyPool(marginlyPool).short(shortBaseAmount);
    IMarginlyPool(marginlyPool).transferPosition(msg.sender);
  }
}