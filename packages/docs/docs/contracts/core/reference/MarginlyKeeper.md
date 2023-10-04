## MarginlyKeeper

Contract helper for Marginly position liquidators.

_It make liquidation with help of AAVE flashloan_

### Profit

```solidity
event Profit(address liquidatedPosition, address token, uint256 amount)
```

_Emitted when liquidation occurs_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidatedPosition | address | liquidated position |
| token | address | profit token |
| amount | uint256 | profit amount |

### LiquidationParams

```solidity
struct LiquidationParams {
  address marginlyPool;
  address positionToLiquidate;
  address liquidator;
  uint256 minProfit;
}
```

### ADDRESSES_PROVIDER

  ```solidity
  contract IPoolAddressesProvider ADDRESSES_PROVIDER
  ```

### POOL

  ```solidity
  contract IPool POOL
  ```

### constructor

```solidity
constructor(address addressesProvider) public
```

### flashLoan

```solidity
function flashLoan(address asset, uint256 amount, uint16 referralCode, address marginlyPool, address positionToLiquidate, uint256 minProfit) external
```

Takes simple flashloan in AAVE v3 protocol to liquidate position in Marginly

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| asset | address | borrow asset |
| amount | uint256 | borrow amount |
| referralCode | uint16 | referral code to get rewards in AAVE |
| marginlyPool | address | address of marginly pool |
| positionToLiquidate | address | address of liquidatable position in Marginly pool |
| minProfit | uint256 | amount of minimum profit worth in borrow asset |

### executeOperation

```solidity
function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes data) external returns (bool)
```

Executes an operation after receiving the flash-borrowed asset

_Ensure that the contract can return the debt + premium, e.g., has
     enough funds to repay and has approved the Pool to pull the total amount_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| asset | address | The address of the flash-borrowed asset |
| amount | uint256 | The amount of the flash-borrowed asset |
| premium | uint256 | The fee of the flash-borrowed asset |
| initiator | address | The address of the flashloan initiator |
| data | bytes |  |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if the execution of the operation succeeds, false otherwise |

