// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface IAction {
  struct ActionArgs {
    address position;
    address marginlyPool;
    bytes callData;
  }

  /// @dev Returns true if conditions for execution met
  /// @param actionArgs action calldata
  /// @param encodedTriggerData encoded trigger data stored with subscription options
  function isTriggered(ActionArgs calldata actionArgs, bytes calldata encodedTriggerData) external view returns (bool);

  /// @dev Execute action
  /// @param actionArgs action calldata
  /// @param encodedTriggerData encoded trigger data stored with subscription options
  function execute(ActionArgs calldata actionArgs, bytes calldata encodedTriggerData) external returns (bytes memory);
}
