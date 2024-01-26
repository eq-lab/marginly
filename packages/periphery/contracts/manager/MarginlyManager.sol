// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@marginly/contracts/contracts/interfaces/IMarginlyPool.sol';
import '@marginly/contracts/contracts/interfaces/IMarginlyFactory.sol';

import './interfaces/IAction.sol';

contract MarginlyManager {
  error ZeroAddress();
  error UnknownMarginlyPool();
  error ActionFailed();
  error ActionNotTriggered();
  error NoSubscription();

  event Subscribed(
    address indexed position,
    address indexed marginlyPool,
    address indexed action,
    bool isOneTime,
    bytes subCallData
  );

  event ActionExecuted(
    address indexed position,
    address indexed marginlyPool,
    address indexed action,
    uint256 fee,
    bytes result
  );

  struct SubOptions {
    bool isOneTime;
    bytes callData;
  }

  /// @notice Address of marginly factory
  address public marginlyFactory;

  /// @notice Subscriptions on actions. Key position => marginlyPool => action => subCallData;
  mapping(address => mapping(address => mapping(address => SubOptions))) public subscriptions;

  /// @dev reentrancy guard
  bool private locked;

  constructor(address _marginlyFactory) {
    if (_marginlyFactory == address(0)) revert ZeroAddress();

    marginlyFactory = _marginlyFactory;
  }

  function _lock() private view {
    if (locked) revert Errors.Locked();
  }

  /// @dev Protects against reentrancy
  modifier lock() {
    _lock();
    locked = true;
    _;
    delete locked;
  }

  /// @notice Subscribe msg.sender position to action
  /// @dev To unsubscribe pass default subOptions
  /// @param marginlyPool Address of marginly pool
  /// @param action Address of action contract
  /// @param subOptions Subscription options
  function subscribe(address marginlyPool, address action, SubOptions calldata subOptions) external {
    if (action == address(0)) revert ZeroAddress();
    if (!IMarginlyFactory(marginlyFactory).isPoolExists(marginlyPool)) revert UnknownMarginlyPool();

    subscriptions[msg.sender][marginlyPool][action] = subOptions;

    emit Subscribed(msg.sender, marginlyPool, action, subOptions.isOneTime, subOptions.callData);
  }

  /// @notice Execute action
  /// @param action Address of action
  /// @param actionArgs Action arguments
  function execute(address action, IAction.ActionArgs calldata actionArgs) external lock {
    SubOptions memory subOptions = subscriptions[actionArgs.position][actionArgs.marginlyPool][action];
    if (subOptions.callData.length == 0) revert NoSubscription();

    if (!IAction(action).isTriggered(actionArgs, subOptions.callData)) revert ActionNotTriggered();

    (bool success, bytes memory result) = action.delegatecall(
      abi.encodeWithSignature('execute((address,address,bytes),bytes)', actionArgs, subOptions)
    );
    if (!success) revert ActionFailed();

    if (subOptions.isOneTime) {
      delete subscriptions[actionArgs.position][actionArgs.marginlyPool][action];
    }

    address quoteToken = IMarginlyPool(actionArgs.marginlyPool).quoteToken();
    uint256 fee = IERC20(quoteToken).balanceOf(address(this));
    TransferHelper.safeTransfer(quoteToken, msg.sender, fee);

    emit ActionExecuted(actionArgs.position, actionArgs.marginlyPool, action, fee, result);
  }
}
