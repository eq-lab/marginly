// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '../manager/interfaces/IAction.sol';

import '@marginly/contracts/contracts/interfaces/IMarginlyPool.sol';
import '@marginly/contracts/contracts/dataTypes/Call.sol';

import 'hardhat/console.sol';

contract TestAction is IAction {
  struct SubOptions {
    bool isOneTime;
    bytes callData;
  }

  /// @notice Address of marginly factory
  address public marginlyFactory;

  /// @notice Subscriptions on actions. Key position => marginlyPool => action => subCallData;
  mapping(address => mapping(address => mapping(address => SubOptions))) public subscriptions;

  function isTriggered(IAction.ActionArgs memory, bytes memory) external pure returns (bool) {
    return true;
  }

  function execute(IAction.ActionArgs memory actionCallData, bytes memory) external returns (bytes memory) {
    bool shouldFail = abi.decode(actionCallData.callData, (bool));
    if (shouldFail) revert('Action failed');
    delete subscriptions[actionCallData.position][actionCallData.marginlyPool][address(this)];
  }
}
