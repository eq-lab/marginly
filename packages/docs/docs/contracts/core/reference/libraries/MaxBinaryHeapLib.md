## MaxBinaryHeapLib

_Implemented to use as embedded library. Invariant: key should be greater than zero_

### Node

```solidity
struct Node {
  uint96 key;
  address account;
}
```

### Heap

```solidity
struct Heap {
  mapping(uint32 => struct MaxBinaryHeapLib.Node) nodes;
  uint32 length;
}
```

### insert

```solidity
function insert(struct MaxBinaryHeapLib.Heap self, mapping(address => struct Position) positions, struct MaxBinaryHeapLib.Node node) internal returns (uint32)
```

_Inserting a new element into the heap. Time complexity O(Log n)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| self | struct MaxBinaryHeapLib.Heap | The heap |
| positions | mapping(address &#x3D;&gt; struct Position) |  |
| node | struct MaxBinaryHeapLib.Node | The node should be inserted into the heap |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 | index The index of inserted node |

### update

```solidity
function update(struct MaxBinaryHeapLib.Heap self, mapping(address => struct Position) positions, uint32 index, uint96 newKey) internal returns (uint32 newIndex)
```

_Update key value at index and change node position_

### updateAccount

```solidity
function updateAccount(struct MaxBinaryHeapLib.Heap self, uint32 index, address account) internal
```

_Update account value of node_

### getNodeByIndex

```solidity
function getNodeByIndex(struct MaxBinaryHeapLib.Heap self, uint32 index) internal view returns (bool success, struct MaxBinaryHeapLib.Node node)
```

_Returns heap node by index_

### remove

```solidity
function remove(struct MaxBinaryHeapLib.Heap self, mapping(address => struct Position) positions, uint32 index) internal
```

_Removes node by account_

