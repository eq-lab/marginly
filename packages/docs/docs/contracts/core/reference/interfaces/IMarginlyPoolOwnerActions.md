## IMarginlyPoolOwnerActions

### setParameters

```solidity
function setParameters(struct MarginlyParams _params) external
```

Sets the pool parameters. May only be called by the pool owner

### shutDown

```solidity
function shutDown(uint256 swapCalldata) external
```

Switch to emergency mode when collateral of any side not enough to cover debt

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| swapCalldata | uint256 | router calldata for splitting swap to reduce potential sandwich attacks impact |

### sweepETH

```solidity
function sweepETH() external
```

Sweep ETH balance of contract

