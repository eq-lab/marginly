// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TestERC20Token is ERC20 {
  constructor(string memory name, string memory symbol) ERC20(name, symbol) {
    _mint(msg.sender, 1_000_000 * 10 ** uint(decimals()));
  }

  receive() external payable {}

  function mint(address account, uint256 amount) external {
    _mint(account, amount);
  }
}
