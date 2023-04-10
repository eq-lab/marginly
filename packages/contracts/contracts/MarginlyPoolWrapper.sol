// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import './interfaces/IMarginlyPool.sol';
import './interfaces/IMarginlyPoolWrapper.sol';
import './libraries/FP96.sol';

contract MarginlyPoolWrapper is IMarginlyPoolWrapper {
  address public marginlyPool;

  constructor(address _marginlyPool) {
    marginlyPool = _marginlyPool;
  }

  function long(uint256 depositBaseAmount, uint256 longBaseAmount) external {
    address baseToken = IMarginlyPool(marginlyPool).baseToken();
    TransferHelper.safeTransferFrom(baseToken, msg.sender, address(this), depositBaseAmount);
    TransferHelper.safeApprove(baseToken, marginlyPool, depositBaseAmount);
    IMarginlyPool(marginlyPool).depositBase(depositBaseAmount);
    IMarginlyPool(marginlyPool).long(longBaseAmount);
    IMarginlyPool(marginlyPool).transferPosition(msg.sender);
  }

  function short(uint256 depositQuoteAmount, uint256 shortBaseAmount) external {
    address quoteToken = IMarginlyPool(marginlyPool).quoteToken();
    TransferHelper.safeTransferFrom(quoteToken, msg.sender, address(this), depositQuoteAmount);
    TransferHelper.safeApprove(quoteToken, marginlyPool, depositQuoteAmount);
    IMarginlyPool(marginlyPool).depositQuote(depositQuoteAmount);
    IMarginlyPool(marginlyPool).short(shortBaseAmount);
    IMarginlyPool(marginlyPool).transferPosition(msg.sender);
  }
}