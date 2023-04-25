// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol';

contract Token is ERC20PresetMinterPauser {
    constructor(string memory name, string memory symbol, uint8 decimals) ERC20PresetMinterPauser(name, symbol) {
        _setupDecimals(decimals);
    }
}
