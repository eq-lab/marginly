## IMarginlyRouter

### ZeroAmount

```solidity
error ZeroAmount()
```

Emitted when swap with zero input or output was called

### WrongAmountOut

```solidity
error WrongAmountOut()
```

Emitted if balance difference doesn't equal amountOut

### Swap

```solidity
event Swap(bool isExactInput, uint256 dexIndex, address receiver, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)
```

Emitted when swap happened

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| isExactInput | bool | true if swapExactInput, false if swapExactOutput |
| dexIndex | uint256 | index of the dex used for swap |
| receiver | address | swap result receiver |
| tokenIn | address | address of a token swapped on dex |
| tokenOut | address | address of a token received from dex |
| amountIn | uint256 | amount of tokenIn swapped |
| amountOut | uint256 | amount of tokenOut received |

### swapExactInput

```solidity
function swapExactInput(uint256 swapCalldata, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external returns (uint256 amountOut)
```

swap with exact input

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| swapCalldata | uint256 | calldata for multiple swaps |
| tokenIn | address | address of a token to swap on dex |
| tokenOut | address | address of a token to receive from dex |
| amountIn | uint256 | exact amount of tokenIn to swap |
| minAmountOut | uint256 | minimal amount of tokenOut to receive |

### swapExactOutput

```solidity
function swapExactOutput(uint256 swapCalldata, address tokenIn, address tokenOut, uint256 maxAmountIn, uint256 amountOut) external returns (uint256 amountIn)
```

swap with exact output

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| swapCalldata | uint256 | calldata for multiple swaps |
| tokenIn | address | address of a token to swap on dex |
| tokenOut | address | address of a token to receive from dex |
| maxAmountIn | uint256 | maximal amount of tokenIn to swap |
| amountOut | uint256 | exact amount of tokenOut to receive |

### adapterCallback

```solidity
function adapterCallback(address recipient, uint256 amount, bytes data) external
```

this function can be called by known adapters only

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | to whom transfer the tokens from swap initiator |
| amount | uint256 | amount of tokens to transfer |
| data | bytes | callback data with transfer details and info to verify sender |

