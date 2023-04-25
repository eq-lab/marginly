// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import '../dataTypes/Position.sol';

/// @title A Max-Heap implementation
/// @dev Implemented to use as embedded library. Invariant: key should be greater than zero
library MaxBinaryHeapLib {
  /// @dev Node structure to store key value and arbitrary data. 1 slot of data key 96 + address 160 = 256
  struct Node {
    /// @dev Stored as FixedPoint value with 10 bits for decimals
    uint96 key;
    /// @dev Account address
    address account;
  }

  /// @dev Heap representation. Using length and mapping instead of array reduce gas costs.
  struct Heap {
    /// @dev Total length of the Heap
    uint32 length;
    /// @dev Keep heap elements by index
    mapping(uint32 => Node) nodes;
  }

  /// @dev Inserting a new element into the heap. Time complexity O(Log n)
  /// @param self The heap
  /// @param node The node should be inserted into the heap
  /// @return index The index of inserted node
  function insert(
    Heap storage self,
    mapping(address => Position) storage positions,
    Node memory node
  ) internal returns (uint32) {
    uint32 index = self.length;
    self.nodes[index] = node;

    positions[node.account].heapPosition = index + 1;

    self.length = index + 1;
    return heapifyUp(self, positions, index);
  }

  /// @dev Update key value at index and change node position
  function update(
    Heap storage self,
    mapping(address => Position) storage positions,
    uint32 index,
    uint96 newKey
  ) internal returns (uint32 newIndex) {
    require(index < self.length, 'WI'); // Wrong index

    Node storage node = self.nodes[index];
    if (node.key < newKey) {
      node.key = newKey;
      newIndex = heapifyUp(self, positions, index);
    } else {
      node.key = newKey;
      newIndex = heapifyDown(self, positions, index);
    }
  }

  ///@dev Update account value of node
  function updateAccount(Heap storage self, uint32 index, address account) internal {
    self.nodes[index].account = account;
  }

  /// @dev Returns heap node by index
  function getNodeByIndex(Heap storage self, uint32 index) internal view returns (bool success, Node memory node) {
    if (index < self.length) {
      success = true;
      node = self.nodes[index];
    }
  }

  /// @dev Removes node by account
  function remove(Heap storage self, mapping(address => Position) storage positions, uint32 index) internal {
    uint32 length = self.length;
    require(index < length, 'WI'); // Wrong index

    uint32 last = length - 1;
    self.length = last;

    positions[self.nodes[index].account].heapPosition = 0;

    if (length != 1) {
      self.nodes[index] = self.nodes[last];
      positions[self.nodes[index].account].heapPosition = index + 1;
      heapifyDown(self, positions, index);
    }

    delete self.nodes[last];
  }

  /// @dev Swap two elements in the heap
  function swap(
    Heap storage self,
    mapping(address => Position) storage positions,
    uint32 first,
    uint32 second
  ) private {
    Node memory firstNode = self.nodes[first];
    Node memory secondNode = self.nodes[second];

    positions[firstNode.account].heapPosition = second + 1;
    positions[secondNode.account].heapPosition = first + 1;

    self.nodes[first] = secondNode;
    self.nodes[second] = firstNode;
  }

  /// @dev Traverse up starting from the `startIndex`
  function heapifyUp(
    Heap storage self,
    mapping(address => Position) storage positions,
    uint32 startIndex
  ) private returns (uint32) {
    uint32 index = startIndex;
    while (index != 0) {
      // optimized: "!= 0" costs less than "< 0" for unsigned
      uint32 parentIndex = (index - 1) >> 1;

      if (self.nodes[parentIndex].key >= self.nodes[index].key) {
        break;
      }

      swap(self, positions, index, parentIndex);
      index = parentIndex;
    }

    return index;
  }

  /// @dev Traverse down starting from the `startIndex`
  function heapifyDown(
    Heap storage self,
    mapping(address => Position) storage positions,
    uint32 startIndex
  ) private returns (uint32) {
    uint32 index = startIndex;
    uint32 length = self.length;

    while (true) {
      uint32 biggest = index;

      uint32 left = (index << 1) + 1;
      uint32 right = (index << 1) + 2;

      if (left < length) {
        // optimized: nested "if" costs less gas than combined
        if (self.nodes[left].key > self.nodes[biggest].key) {
          biggest = left;
        }
      }

      if (right < length) {
        // optimized: nested "if" costs less gas than combined
        if (self.nodes[right].key > self.nodes[biggest].key) {
          biggest = right;
        }
      }

      if (biggest == index) {
        break;
      }

      swap(self, positions, index, biggest);
      index = biggest;
    }

    return index;
  }
}
