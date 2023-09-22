// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '../dataTypes/MarginlyParams.sol';

interface IMarginlyPoolOwnerActions {
  /// @notice Sets the pool parameters. May only be called by the pool owner
  function setParameters(MarginlyParams calldata _params) external;

  /// @notice Switch to emergency mode when collateral of any side not enough to cover debt
  /// @param swapCalldata router calldata for splitting swap to reduce potential sandwich attacks impact
  function shutDown(uint256 swapCalldata) external;

  /// @notice Sweep ETH balance of contract
  function sweepETH() external;
}
