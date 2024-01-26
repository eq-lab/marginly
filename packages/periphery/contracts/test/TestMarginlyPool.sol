// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

contract TestMarginlyPool {
  address public quoteToken;

  constructor(address _quoteToken) {
    quoteToken = _quoteToken;
  }
}
