// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface IBlast {
  function configureClaimableGas() external;

  function claimMaxGas(address contractAddress, address recipient) external returns (uint256);
}