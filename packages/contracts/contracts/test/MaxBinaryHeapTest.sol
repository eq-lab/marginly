// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '../libraries/MaxBinaryHeapLib.sol';

/// @dev Minimal contract to test MinHeapLib internal functions
contract MaxBinaryHeapTest {
  using MaxBinaryHeapLib for MaxBinaryHeapLib.Heap;

  MaxBinaryHeapLib.Heap private heap;
  mapping(address => Position) public positions;

  constructor() {}

  function add(uint96 key, address account) public {
    MaxBinaryHeapLib.Node memory node = MaxBinaryHeapLib.Node({key: key, account: account});
    heap.insert(positions, node);
  }

  function updateByIndex(uint32 index, uint96 value) public returns (uint) {
    return heap.update(positions, index, value);
  }

  function updateAccount(uint32 index, address account) public {
    return heap.updateAccount(index, account);
  }

  function remove(uint32 index) public {
    return heap.remove(positions, index);
  }

  function getHeapLength() public view returns (uint256) {
    return heap.length;
  }

  function isEmpty() public view returns (bool) {
    return heap.length == 0;
  }

  function getNodeByIndex(uint32 index) public view returns (bool success, MaxBinaryHeapLib.Node memory) {
    return heap.getNodeByIndex(index);
  }
}
