## OracleLib

Provides functions to integrate with V3 pool oracle

### T

```solidity
error T()
```

### ZeroSeconds

```solidity
error ZeroSeconds()
```

### getSqrtPriceX96

```solidity
function getSqrtPriceX96(address pool, uint32 secondsAgo) internal view returns (uint256 priceX96)
```

Calculates sqrt of TWAP price

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | Address of the pool that we want to observe |
| secondsAgo | uint32 | Number of seconds in the past from which to calculate the time-weighted means |

