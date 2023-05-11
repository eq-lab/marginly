// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '../interfaces/IWETH9.sol';

/// @dev Test ERC20 token.
contract TestERC20 is ERC20, IWETH9 {
  constructor(string memory name, string memory symbol) ERC20(name, symbol) {
    _mint(msg.sender, 1_000_000 * 10 ** uint(decimals()));
  }

  receive() external payable {}

  function mint(address account, uint256 amount) external {
    _mint(account, amount);
  }

  function deposit() external payable override {
    _mint(msg.sender, msg.value);
  }

  function withdraw(uint256 amount) external override {
    require(balanceOf(msg.sender) >= amount);
    _burn(msg.sender, amount);
    (bool success, ) = msg.sender.call{value: amount}(new bytes(0));
    require(success, 'STE');
  }
}
