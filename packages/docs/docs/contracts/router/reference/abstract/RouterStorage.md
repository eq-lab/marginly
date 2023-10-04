## AdapterInput

```solidity
struct AdapterInput {
  uint256 dexIndex;
  address adapter;
}
```

## RouterStorage

### NewAdapter

```solidity
event NewAdapter(uint256 dexIndex, address adapter)
```

Emitted when new adapter is added

### UnknownDex

```solidity
error UnknownDex()
```

### adapters

```solidity
mapping(uint256 => address) adapters
```

### constructor

```solidity
constructor(struct AdapterInput[] _adapters) internal
```

### addDexAdapters

```solidity
function addDexAdapters(struct AdapterInput[] _adapters) external
```

### getAdapterSafe

```solidity
function getAdapterSafe(uint256 dexIndex) internal view returns (contract IMarginlyAdapter)
```

