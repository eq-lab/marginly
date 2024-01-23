// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

enum RStatus {
  ONE,
  ABOVE_ONE,
  BELOW_ONE
}

interface IDODOCallee {
  function dodoCall(bool isBuyBaseToken, uint256 baseAmount, uint256 quoteAmount, bytes calldata data) external;
}

contract TestDodoV1Pool {
  address public _MAINTAINER_;

  address public _BASE_TOKEN_;
  address public _QUOTE_TOKEN_;

  uint256 public _BASE_BALANCE_;
  uint256 public _QUOTE_BALANCE_;

  uint256 public _BASE_TO_QUOTE_PRICE_ = 10;

  constructor(address baseToken, address quoteToken) {
    _BASE_TOKEN_ = baseToken;
    _QUOTE_TOKEN_ = quoteToken;
  }

  function sellBaseToken(uint256 amount, uint256 minReceiveQuote, bytes calldata data) external returns (uint256) {
    // query price
    (uint256 receiveQuote, uint256 lpFeeQuote, uint256 mtFeeQuote, , , ) = _querySellBaseToken(amount);
    require(receiveQuote >= minReceiveQuote, 'SELL_BASE_RECEIVE_NOT_ENOUGH');

    // settle assets
    _quoteTokenTransferOut(msg.sender, receiveQuote);
    if (data.length > 0) {
      IDODOCallee(msg.sender).dodoCall(false, amount, receiveQuote, data);
    }
    _baseTokenTransferIn(msg.sender, amount);
    if (mtFeeQuote != 0) {
      _quoteTokenTransferOut(_MAINTAINER_, mtFeeQuote);
    }

    _donateQuoteToken(lpFeeQuote);

    return receiveQuote;
  }

  function buyBaseToken(uint256 amount, uint256 maxPayQuote, bytes calldata data) external returns (uint256) {
    // query price
    (uint256 payQuote, uint256 lpFeeBase, uint256 mtFeeBase, , , ) = _queryBuyBaseToken(amount);
    require(payQuote <= maxPayQuote, 'BUY_BASE_COST_TOO_MUCH');

    // settle assets
    _baseTokenTransferOut(msg.sender, amount);
    if (data.length > 0) {
      IDODOCallee(msg.sender).dodoCall(true, amount, payQuote, data);
    }
    _quoteTokenTransferIn(msg.sender, payQuote);
    if (mtFeeBase != 0) {
      _baseTokenTransferOut(_MAINTAINER_, mtFeeBase);
    }

    _donateBaseToken(lpFeeBase);

    return payQuote;
  }

  function querySellBaseToken(uint256 amount) external view returns (uint256 receiveQuote) {
    (receiveQuote, , , , , ) = _querySellBaseToken(amount);
    return receiveQuote;
  }

  function queryBuyBaseToken(uint256 amount) external view returns (uint256 payQuote) {
    (payQuote, , , , , ) = _queryBuyBaseToken(amount);
    return payQuote;
  }

  function _querySellBaseToken(
    uint256 amount
  )
    internal
    view
    returns (
      uint256 receiveQuote,
      uint256 lpFeeQuote,
      uint256 mtFeeQuote,
      RStatus newRStatus,
      uint256 newQuoteTarget,
      uint256 newBaseTarget
    )
  {
    receiveQuote = _BASE_TO_QUOTE_PRICE_ * amount;
    return (receiveQuote, lpFeeQuote, mtFeeQuote, newRStatus, newQuoteTarget, newBaseTarget);
  }

  function _queryBuyBaseToken(
    uint256 amount
  )
    internal
    view
    returns (
      uint256 payQuote,
      uint256 lpFeeBase,
      uint256 mtFeeBase,
      RStatus newRStatus,
      uint256 newQuoteTarget,
      uint256 newBaseTarget
    )
  {
    payQuote = _BASE_TO_QUOTE_PRICE_ * amount;
    return (payQuote, lpFeeBase, mtFeeBase, newRStatus, newQuoteTarget, newBaseTarget);
  }

  function _baseTokenTransferIn(address from, uint256 amount) private {
    IERC20(_BASE_TOKEN_).transferFrom(from, address(this), amount);
    _BASE_BALANCE_ = _BASE_BALANCE_ + amount;
  }

  function _quoteTokenTransferIn(address from, uint256 amount) private {
    IERC20(_QUOTE_TOKEN_).transferFrom(from, address(this), amount);
    _QUOTE_BALANCE_ = _QUOTE_BALANCE_ + amount;
  }

  function _baseTokenTransferOut(address to, uint256 amount) private {
    IERC20(_BASE_TOKEN_).transfer(to, amount);
    _BASE_BALANCE_ = _BASE_BALANCE_ - amount;
  }

  function _quoteTokenTransferOut(address to, uint256 amount) private {
    IERC20(_QUOTE_TOKEN_).transfer(to, amount);
    _QUOTE_BALANCE_ = _QUOTE_BALANCE_ - amount;
  }

  function _donateBaseToken(uint256 /*amount*/) private pure {
    return;
  }

  function _donateQuoteToken(uint256 /*amount*/) private pure {
    return;
  }

  function sync() public {
    uint256 baseBalance = IERC20(_BASE_TOKEN_).balanceOf(address(this));
    uint256 quoteBalance = IERC20(_QUOTE_TOKEN_).balanceOf(address(this));

    if (baseBalance != _BASE_BALANCE_) {
      _BASE_BALANCE_ = uint112(baseBalance);
    }
    if (quoteBalance != _QUOTE_BALANCE_) {
      _QUOTE_BALANCE_ = uint112(quoteBalance);
    }
  }
}
