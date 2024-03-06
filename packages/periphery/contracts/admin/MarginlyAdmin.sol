// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import './abstract/AdapterActions.sol';
import './abstract/FactoryActions.sol';
import './abstract/PoolActions.sol';
import './abstract/RouterActions.sol';

contract MarginlyAdmin is AdapterActions, FactoryActions, PoolActions, RouterActions {
  constructor(address marginlyFactory) MarginlyAdminStorage(marginlyFactory) {}
}
