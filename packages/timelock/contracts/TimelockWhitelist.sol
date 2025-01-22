// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.27;

import {TimelockController} from '@openzeppelin/contracts/governance/TimelockController.sol';

contract TimelockWhitelist is TimelockController {
  event WhitelistMethod(address indexed target, bytes4 indexed method, bool add);

  ///@notice Mapping to store whitelisted addresses and methods
  mapping(address => mapping(bytes4 => bool)) private _whitelistedMethods;

  constructor(
    uint256 minDelay,
    address[] memory proposers,
    address[] memory executors,
    address admin,
    address[] memory whitelistedTargets,
    bytes4[] memory whitelistedMethods
  ) TimelockController(minDelay, proposers, executors, admin) {
    require(whitelistedTargets.length == whitelistedMethods.length, 'whitelistTargets: length mismatch');

    uint256 i = 0;
    uint256 length = whitelistedTargets.length;
    for (; i < length; ) {
      _whitelistedMethods[whitelistedTargets[i]][whitelistedMethods[i]] = true;

      unchecked {
        ++i;
      }
    }
  }

  ///@notice Whitelist and unwhitelist methods
  function whitelistMethods(address[] calldata targets, bytes4[] calldata methods, bool[] calldata adds) external {
    require(targets.length == methods.length && methods.length == adds.length, 'Wrong length');

    address sender = _msgSender();
    if (sender != address(this)) {
      revert TimelockController.TimelockUnauthorizedCaller(sender);
    }

    uint256 i = 0;
    uint256 length = targets.length;
    for (; i < length; ) {
      address target = targets[i];
      bytes4 method = methods[i];
      bool add = adds[i];

      _whitelistedMethods[target][method] = add;
      emit WhitelistMethod(target, method, add);

      unchecked {
        ++i;
      }
    }
  }

  ///@notice Check target and method is whitelisted
  function isWhitelisted(address target, bytes4 method) public view returns (bool) {
    return _whitelistedMethods[target][method];
  }

  ///@dev Override `execute` to support whitelisted methods
  function execute(
    address target,
    uint256 value,
    bytes calldata data,
    bytes32 predecessor,
    bytes32 salt
  ) public payable override onlyRoleOrOpenRole(EXECUTOR_ROLE) {
    bytes4 method = bytes4(data[:4]);

    if (isWhitelisted(target, method)) {
      // Instant execution for whitelisted methods
      require(target != address(0), 'TimelockController: target address is zero');
      _execute(target, value, data);
      emit CallExecuted(0, 0, target, value, data);
    } else {
      // Fallback to normal timelock execution
      super.execute(target, value, data, predecessor, salt);
    }
  }
}
