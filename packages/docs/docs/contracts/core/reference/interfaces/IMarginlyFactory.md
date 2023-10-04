## IMarginlyFactory

### PoolCreated

```solidity
event PoolCreated(address quoteToken, address baseToken, address uniswapPool, bool quoteTokenIsToken0, address pool)
```

Emitted when a pool is created

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| quoteToken | address | The stable-coin |
| baseToken | address | The base token |
| uniswapPool | address | The address of associated Uniswap pool |
| quoteTokenIsToken0 | bool | What token in Uniswap pool is stable-coin |
| pool | address | The address of the created pool |

### SwapRouterChanged

```solidity
event SwapRouterChanged(address newSwapRouter)
```

Emitted when changeSwapRouter was executed

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newSwapRouter | address | new swap router address |

### createPool

```solidity
function createPool(address quoteToken, address baseToken, uint24 uniswapFee, struct MarginlyParams params) external returns (address pool)
```

Creates a pool for the two given tokens and fee

_tokenA and tokenB may be passed in either order: token0/token1 or token1/token0. tickSpacing is retrieved
from the fee. The call will revert if the pool already exists, the fee is invalid, or the token arguments
are invalid._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| quoteToken | address | One of the two tokens in the desired pool |
| baseToken | address | The other of the two tokens in the desired pool |
| uniswapFee | uint24 | Fee for uniswap pool |
| params | struct MarginlyParams | pool parameters |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the newly created pool |

### changeSwapRouter

```solidity
function changeSwapRouter(address newSwapRouter) external
```

Changes swap router address used by Marginly pools

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newSwapRouter | address | address of new swap router |

### getPool

```solidity
function getPool(address quoteToken, address baseToken, uint24 fee) external view returns (address pool)
```

Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist

_quoteToken and baseToken may be passed in either token0/token1 or token1/token0 order_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| quoteToken | address | The contract address of stable-coin |
| baseToken | address | The contract address of the other token |
| fee | uint24 | The fee collected upon every swap in the pool, denominated in hundredths of a bip |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The pool address |

### swapRouter

```solidity
function swapRouter() external view returns (address)
```

Returns swapRouter

### feeHolder

```solidity
function feeHolder() external view returns (address)
```

Swap fee holder address

### WETH9

```solidity
function WETH9() external view returns (address)
```

Address of wrapper

### techPositionOwner

```solidity
function techPositionOwner() external view returns (address)
```

Address of technical position

