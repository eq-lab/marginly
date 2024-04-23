// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/// @dev Test ERC20 token.
contract TestERC20 is ERC20 {
  uint8 private _decimals;

  constructor(string memory name, string memory symbol, uint8 __decimals) ERC20(name, symbol) {
    _decimals = __decimals;
    _mint(msg.sender, 1_000_000 * 10 ** uint(_decimals));
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }
}
