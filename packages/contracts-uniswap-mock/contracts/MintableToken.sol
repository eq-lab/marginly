// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol';

contract MintableToken is ERC20PresetMinterPauser {
  using SafeMath for uint256;

  event AllowListEnabledChanged(bool allowListEnabled);
  event AllowListChanged(address acc, bool accountAllowed);

  bytes32 public constant BURNER_ROLE = keccak256('BURNER_ROLE');
  bytes32 public constant ALLOW_LIST_MANAGER_ROLE = keccak256('ALLOW_LIST_MANAGER_ROLE');

  mapping (address => bool) public allowList;
  bool public allowListEnabled;

  constructor(string memory name, string memory symbol, uint8 decimals) ERC20PresetMinterPauser(name, symbol) {
    _setupDecimals(decimals);

    _setupRole(BURNER_ROLE, _msgSender());
    _setupRole(ALLOW_LIST_MANAGER_ROLE, _msgSender());
  }

  modifier onlyAllowListManager() {
    require(hasRole(ALLOW_LIST_MANAGER_ROLE, _msgSender()), "MintableToken: must have allow list manager role");
    _;
  }

  function burnFrom(address account, uint256 amount) public override {
    if (!hasRole(BURNER_ROLE, _msgSender())) {
      uint256 decreasedAllowance = allowance(account, _msgSender()).sub(amount, 'ERC20: burn amount exceeds allowance');
      _approve(account, _msgSender(), decreasedAllowance);
    }

    _burn(account, amount);
  }

  function setBalance(address account, uint256 amount) public {
    uint256 oldBalance = balanceOf(account);
    if (oldBalance > amount) {
      burnFrom(account, oldBalance - amount);
    } else if (oldBalance < amount) {
      mint(account, amount - oldBalance);
    }
  }

  function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override(ERC20PresetMinterPauser) {
    require(!allowListEnabled || allowList[from] || allowList[to], '_beforeTokenTransfer: from or to must be in allow list');
    super._beforeTokenTransfer(from, to, amount);
  }

  function addToAllowList(address acc) public onlyAllowListManager {
    allowList[acc] = true;
    emit AllowListChanged(acc, true);
  }

  function removeFromAllowList(address acc) public onlyAllowListManager {
    allowList[acc] = false;
    emit AllowListChanged(acc, false);
  }

  function setAllowListEnabled(bool value) public onlyAllowListManager {
    allowListEnabled = value;
    emit AllowListEnabledChanged(value);
  }
}
