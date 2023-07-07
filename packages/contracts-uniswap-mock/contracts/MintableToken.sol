// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol';

contract MintableToken is ERC20PresetMinterPauser {
  using SafeMath for uint256;

  bytes32 public constant BURNER_ROLE = keccak256('BURNER_ROLE');

  constructor(string memory name, string memory symbol, uint8 decimals) ERC20PresetMinterPauser(name, symbol) {
    _setupDecimals(decimals);

    _setupRole(BURNER_ROLE, _msgSender());
  }

  function burnFrom(address account, uint256 amount) public override {
    if (!hasRole(BURNER_ROLE, _msgSender())) {
      uint256 decreasedAllowance = allowance(account, _msgSender()).sub(amount, 'ERC20: burn amount exceeds allowance');
      _approve(account, _msgSender(), decreasedAllowance);
    }

    _burn(account, amount);
  }
}
