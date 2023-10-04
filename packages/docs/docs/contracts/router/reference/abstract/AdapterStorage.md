## PoolInput

```solidity
struct PoolInput {
  address token0;
  address token1;
  address pool;
}
```

## AdapterStorage

### NewPool

```solidity
event NewPool(address token0, address token1, address pool)
```

Emitted when new pool is added

### UnknownPool

```solidity
error UnknownPool()
```

### getPool

```solidity
mapping(address => mapping(address => address)) getPool
```

### constructor

```solidity
constructor(struct PoolInput[] pools) internal
```

### addPools

```solidity
function addPools(struct PoolInput[] pools) external
```

### getPoolSafe

```solidity
function getPoolSafe(address tokenA, address tokenB) internal view returns (address pool)
```

