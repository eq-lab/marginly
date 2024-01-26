// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

contract TestMarginlyFactory {
  mapping(address => bool) public isPoolExists;

  function addPool(address pool) external {
    isPoolExists[pool] = true;
  }
}
