// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@openzeppelin/contracts/access/AccessControl.sol';

contract AllowListSupport is AccessControl {
    event AllowListEnabledChanged(bool allowListEnabled);
    event AllowListChanged(address acc, bool accountAllowed);

    bytes32 public constant ALLOW_LIST_MANAGER_ROLE = keccak256('ALLOW_LIST_MANAGER_ROLE');

    mapping (address => bool) public allowList;
    bool public allowListEnabled;

    constructor() {
        _setupRole(ALLOW_LIST_MANAGER_ROLE, _msgSender());
    }

    modifier onlyAllowListManager() {
        require(hasRole(ALLOW_LIST_MANAGER_ROLE, _msgSender()), "MintableToken: must have allow list manager role");
        _;
    }

    function addToAllowList(address acc) public onlyAllowListManager {
        if (!allowList[acc]) {
            allowList[acc] = true;
            emit AllowListChanged(acc, true);
        }
    }

    function removeFromAllowList(address acc) public onlyAllowListManager {
        if (allowList[acc]) {
            allowList[acc] = false;
            emit AllowListChanged(acc, false);
        }
    }

    function setAllowListEnabled(bool value) public onlyAllowListManager {
        if (allowListEnabled != value) {
            allowListEnabled = value;
            emit AllowListEnabledChanged(value);
        }
    }

    function isAccountAllowed(address acc) internal view returns (bool) {
        return !allowListEnabled || allowList[acc];
    }
}