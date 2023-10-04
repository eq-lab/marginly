## IMarginlyPool

### EnactMarginCall

```solidity
event EnactMarginCall(address user, uint256 swapPriceX96)
```

_Emitted when margin call took place_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | User that was reinited |
| swapPriceX96 | uint256 | Price of swap worth in quote token as Q96 |

### Deleverage

```solidity
event Deleverage(enum PositionType positionType, uint256 totalCollateralReduced, uint256 totalDebtReduced)
```

_Emitted when deleverage took place_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| positionType | enum PositionType | deleveraged positions type |
| totalCollateralReduced | uint256 | total collateral reduced from all positions |
| totalDebtReduced | uint256 | total debt reduced from all positions |

### DepositBase

```solidity
event DepositBase(address user, uint256 amount, enum PositionType newPositionType, uint256 baseDiscountedAmount)
```

_Emitted when user deposited base token_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Depositor |
| amount | uint256 | Amount of token user deposited |
| newPositionType | enum PositionType | User position type after deposit |
| baseDiscountedAmount | uint256 | Discounted amount of base tokens after deposit |

### DepositQuote

```solidity
event DepositQuote(address user, uint256 amount, enum PositionType newPositionType, uint256 quoteDiscountedAmount)
```

_Emitted when user deposited quote token_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Depositor |
| amount | uint256 | Amount of token user deposited |
| newPositionType | enum PositionType | User position type after deposit |
| quoteDiscountedAmount | uint256 | Discounted amount of quote tokens after deposit |

### WithdrawBase

```solidity
event WithdrawBase(address user, uint256 amount, uint256 baseDiscountedDelta)
```

_Emitted when user withdrew base token_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | User |
| amount | uint256 | Amount of token user withdrew |
| baseDiscountedDelta | uint256 | Discounted delta amount of base tokens user withdrew |

### WithdrawQuote

```solidity
event WithdrawQuote(address user, uint256 amount, uint256 quoteDiscountedDelta)
```

_Emitted when user withdrew quote token_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | User |
| amount | uint256 | Amount of token user withdrew |
| quoteDiscountedDelta | uint256 | Discounted delta amount of quote tokens user withdrew |

### Short

```solidity
event Short(address user, uint256 amount, uint256 swapPriceX96, uint256 quoteDiscountedDelta, uint256 baseDiscountedDelta)
```

_Emitted when user shorted_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Depositor |
| amount | uint256 | Amount of token user use in short position |
| swapPriceX96 | uint256 | Price of swap worth in quote token as Q96 |
| quoteDiscountedDelta | uint256 | Discounted delta amount of quote tokens |
| baseDiscountedDelta | uint256 | Discounted delta amount of base tokens |

### Long

```solidity
event Long(address user, uint256 amount, uint256 swapPriceX96, uint256 quoteDiscountedDelta, uint256 baseDiscountedDelta)
```

_Emitted when user made long position_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | User |
| amount | uint256 | Amount of token user use in long position |
| swapPriceX96 | uint256 | Price of swap worth in quote token as Q96 |
| quoteDiscountedDelta | uint256 | Discounted delta amount of quote tokens |
| baseDiscountedDelta | uint256 | Discounted delta amount of base tokens |

### ClosePosition

```solidity
event ClosePosition(address user, address token, uint256 collateralDelta, uint256 swapPriceX96, uint256 collateralDiscountedDelta)
```

_Emitted when user closed position_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | User |
| token | address | Collateral token |
| collateralDelta | uint256 | Amount of collateral reduction |
| swapPriceX96 | uint256 | Price of swap worth in quote token as Q96 |
| collateralDiscountedDelta | uint256 | Amount of discounted collateral reduction |

### ReceivePosition

```solidity
event ReceivePosition(address liquidator, address position, enum PositionType newPositionType, uint256 newPositionQuoteDiscounted, uint256 newPositionBaseDiscounted)
```

_Emitted when position liquidation happened_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidator | address | Liquidator |
| position | address | Liquidated position |
| newPositionType | enum PositionType | Type of tx sender new position |
| newPositionQuoteDiscounted | uint256 | Discounted amount of quote tokens for new position |
| newPositionBaseDiscounted | uint256 | Discounted amount of base tokens for new position |

### Emergency

```solidity
event Emergency(enum Mode mode)
```

_When system switched to emergency mode_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| mode | enum Mode | Emergency mode |

### EmergencyWithdraw

```solidity
event EmergencyWithdraw(address who, address token, uint256 amount)
```

_Emitted when user made emergency withdraw_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| who | address | Position owner |
| token | address | Token of withdraw |
| amount | uint256 | Amount of withdraw |

### Reinit

```solidity
event Reinit(uint256 reinitTimestamp)
```

_Emitted when reinit happened_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reinitTimestamp | uint256 | timestamp when reinit happened |

### BalanceSync

```solidity
event BalanceSync()
```

_Emitted when balance sync happened_

### ParametersChanged

```solidity
event ParametersChanged()
```

_Emitted when setParameters method was called_

### initialize

```solidity
function initialize(address quoteToken, address baseToken, bool quoteTokenIsToken0, address uniswapPool, struct MarginlyParams _params) external
```

_Initializes the pool_

### quoteToken

```solidity
function quoteToken() external view returns (address token)
```

Returns the address of quote token from pool

### baseToken

```solidity
function baseToken() external view returns (address token)
```

Returns the address of base token from pool

### uniswapPool

```solidity
function uniswapPool() external view returns (address pool)
```

Returns the address of associated uniswap pool

### factory

```solidity
function factory() external view returns (address)
```

Returns address of Marginly factory

### execute

```solidity
function execute(enum CallType call, uint256 amount1, uint256 amount2, uint256 limitPriceX96, bool unwrapWETH, address receivePositionAddress, uint256 swapCalldata) external payable
```

