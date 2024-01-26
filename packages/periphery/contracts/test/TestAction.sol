// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '../manager/interfaces/IAction.sol';

import '@marginly/contracts/contracts/interfaces/IMarginlyPool.sol';
import '@marginly/contracts/contracts/dataTypes/Call.sol';

import 'hardhat/console.sol';

contract TestAction is IAction {
  function isTriggered(IAction.ActionArgs memory, bytes memory) external pure returns (bool) {
    return true;
  }

  function execute(IAction.ActionArgs memory actionCallData, bytes memory) external returns (bytes memory) {
    bool shouldFail = abi.decode(actionCallData.callData, (bool));
    if (shouldFail) revert('Action failed');
  }
}
