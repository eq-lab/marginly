// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface IBlast {
  // Note: the full interface for IBlast can be found below
  function configureClaimableGas() external;
  function claimAllGas(address contractAddress, address recipient) external returns (uint256);
}