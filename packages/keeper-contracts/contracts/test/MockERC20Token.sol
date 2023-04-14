// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/// @dev Test ERC20 token.
contract MockERC20Token is ERC20 {
  constructor(string memory name, string memory symbol) ERC20(name, symbol) {
    _mint(msg.sender, 1_000_000 * 10 ** uint(decimals()));
  }

  function mint(address account, uint256 amount) external {
    _mint(account, amount);
  }
}
