// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TestDodoV2Pool {
  address public _MAINTAINER_;

  ERC20 public _BASE_TOKEN_;
  ERC20 public _QUOTE_TOKEN_;

  uint112 public _BASE_RESERVE_;
  uint112 public _QUOTE_RESERVE_;

  uint256 public _BASE_TO_QUOTE_PRICE_ = 10;

  constructor(address baseToken, address quoteToken) {
    _BASE_TOKEN_ = ERC20(baseToken);
    _QUOTE_TOKEN_ = ERC20(quoteToken);
  }

  function sellBase(address to) external returns (uint256 receiveQuoteAmount) {
    uint256 baseBalance = _BASE_TOKEN_.balanceOf(address(this));
    uint256 baseInput = baseBalance - uint256(_BASE_RESERVE_);
    uint256 mtFee;
    (receiveQuoteAmount, mtFee) = querySellBase(tx.origin, baseInput);

    _transferQuoteOut(to, receiveQuoteAmount);
    _transferQuoteOut(_MAINTAINER_, mtFee);
    _setReserve(baseBalance, _QUOTE_TOKEN_.balanceOf(address(this)));
  }

  function sellQuote(address to) external returns (uint256 receiveBaseAmount) {
    uint256 quoteBalance = _QUOTE_TOKEN_.balanceOf(address(this));
    uint256 quoteInput = quoteBalance - uint256(_QUOTE_RESERVE_);
    uint256 mtFee;
    (receiveBaseAmount, mtFee) = querySellQuote(tx.origin, quoteInput);

    _transferBaseOut(to, receiveBaseAmount);
    _transferBaseOut(_MAINTAINER_, mtFee);
    _setReserve(_BASE_TOKEN_.balanceOf(address(this)), quoteBalance);
  }

  function querySellBase(
    address trader,
    uint256 payBaseAmount
  ) public view returns (uint256 receiveQuoteAmount, uint256 mtFee) {
    receiveQuoteAmount = payBaseAmount * _BASE_TO_QUOTE_PRICE_;
  }

  function querySellQuote(
    address trader,
    uint256 payQuoteAmount
  ) public view returns (uint256 receiveBaseAmount, uint256 mtFee) {
    receiveBaseAmount = payQuoteAmount / _BASE_TO_QUOTE_PRICE_;
  }

  function sync() public {
    uint256 baseBalance = _BASE_TOKEN_.balanceOf(address(this));
    uint256 quoteBalance = _QUOTE_TOKEN_.balanceOf(address(this));

    if (baseBalance != _BASE_RESERVE_) {
      _BASE_RESERVE_ = uint112(baseBalance);
    }
    if (quoteBalance != _QUOTE_RESERVE_) {
      _QUOTE_RESERVE_ = uint112(quoteBalance);
    }
  }

  function _setReserve(uint256 baseReserve, uint256 quoteReserve) private {
    _BASE_RESERVE_ = uint112(baseReserve);
    _QUOTE_RESERVE_ = uint112(quoteReserve);
  }

  function _transferBaseOut(address to, uint256 amount) internal {
    if (amount > 0) {
      _BASE_TOKEN_.transfer(to, amount);
    }
  }

  function _transferQuoteOut(address to, uint256 amount) internal {
    if (amount > 0) {
      _QUOTE_TOKEN_.transfer(to, amount);
    }
  }
}
