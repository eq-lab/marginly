// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import './interfaces/IWETH9.sol';
import './interfaces/IMarginlyPool.sol';
import './interfaces/IMarginlyPoolWrapper.sol';
import './libraries/FP96.sol';

contract MarginlyPoolWrapper is IMarginlyPoolWrapper {
  /// @dev Marginly pool address to work with
  mapping(address => bool) public whitelistedMarginlyPools;
  /// @dev reentrancy guard
  bool public unlocked;
  /// @dev contract admin
  address public owner;

  address public immutable WETH9;

  constructor(address[] memory marginlyPoolAddresses, address _owner, address _WETH9) {
    for (uint256 index = 0; index < marginlyPoolAddresses.length; ++index) {
      whitelistedMarginlyPools[marginlyPoolAddresses[index]] = true;
    }
    unlocked = true;
    owner = _owner;
    WETH9 = _WETH9;
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

  function _onlyOwner() private view {
    require(msg.sender == owner, 'AD'); // Access denied
  }

  modifier onlyOwner() {
    _onlyOwner();
    _;
  }

  receive() external payable {
    require(false); //Nobody can send ETH without calldata
  }

  /// @inheritdoc IMarginlyPoolWrapper
  function depositBase(address marginlyPoolAddress, uint256 amount) external payable lock {
    require(whitelistedMarginlyPools[marginlyPoolAddress], 'NW'); // not whitelisted

    IMarginlyPool marginlyPool = IMarginlyPool(marginlyPoolAddress);
    depositBaseInternal(marginlyPool, amount);
    marginlyPool.transferPosition(msg.sender);
  }

  /// @inheritdoc IMarginlyPoolWrapper
  function long(address marginlyPoolAddress, uint256 depositBaseAmount, uint256 longBaseAmount) external payable lock {
    require(whitelistedMarginlyPools[marginlyPoolAddress], 'NW'); // not whitelisted

    IMarginlyPool marginlyPool = IMarginlyPool(marginlyPoolAddress);
    depositBaseInternal(marginlyPool, depositBaseAmount);
    marginlyPool.long(longBaseAmount);
    marginlyPool.transferPosition(msg.sender);
  }

  /// @inheritdoc IMarginlyPoolWrapper
  function depositQuote(address marginlyPoolAddress, uint256 amount) external payable lock {
    require(whitelistedMarginlyPools[marginlyPoolAddress], 'NW'); // not whitelisted

    IMarginlyPool marginlyPool = IMarginlyPool(marginlyPoolAddress);
    depositQuoteInternal(marginlyPool, amount);
    marginlyPool.transferPosition(msg.sender);
  }

  /// @inheritdoc IMarginlyPoolWrapper
  function short(
    address marginlyPoolAddress,
    uint256 depositQuoteAmount,
    uint256 shortBaseAmount
  ) external payable lock {
    require(whitelistedMarginlyPools[marginlyPoolAddress], 'NW'); // not whitelisted

    IMarginlyPool marginlyPool = IMarginlyPool(marginlyPoolAddress);
    depositQuoteInternal(marginlyPool, depositQuoteAmount);
    marginlyPool.short(shortBaseAmount);
    marginlyPool.transferPosition(msg.sender);
  }

  /// @dev Internal version without lock modifier
  function depositBaseInternal(IMarginlyPool marginlyPool, uint256 amount) internal {
    address baseToken = marginlyPool.baseToken();
    wrapEthOrTransferErc20(baseToken, amount);
    TransferHelper.safeApprove(baseToken, address(marginlyPool), amount);
    marginlyPool.depositBase(amount);
  }

  /// @dev Internal version without lock modifier
  function depositQuoteInternal(IMarginlyPool marginlyPool, uint256 amount) internal {
    address quoteToken = marginlyPool.quoteToken();
    wrapEthOrTransferErc20(quoteToken, amount);
    TransferHelper.safeApprove(quoteToken, address(marginlyPool), amount);
    marginlyPool.depositQuote(amount);
  }

  function wrapEthOrTransferErc20(address token, uint256 amount) internal {
    if (token == WETH9 && address(this).balance >= amount) {
      IWETH9(WETH9).deposit{value: amount}();
    } else {
      TransferHelper.safeTransferFrom(token, msg.sender, address(this), amount);
    }
  }

  function refundETH() external payable onlyOwner {
    if (address(this).balance > 0) {
      TransferHelper.safeTransferETH(msg.sender, address(this).balance);
    }
  }

  function addPoolAddress(address newPool) external onlyOwner {
    whitelistedMarginlyPools[newPool] = true;
  }

  function deletePoolAddress(address poolToDelete) external onlyOwner {
    delete whitelistedMarginlyPools[poolToDelete];
  }
}
