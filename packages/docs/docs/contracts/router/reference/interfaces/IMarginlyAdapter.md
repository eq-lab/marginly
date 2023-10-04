## IMarginlyAdapter

### InsufficientAmount

```solidity
error InsufficientAmount()
```

### TooMuchRequested

```solidity
error TooMuchRequested()
```

### NotSupported

```solidity
error NotSupported()
```

### swapExactInput

```solidity
function swapExactInput(address recipient, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes data) external returns (uint256 amountOut)
```

swap with exact input

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | recipient of amountOut of tokenOut |
| tokenIn | address | address of a token to swap on dex |
| tokenOut | address | address of a token to receive from dex |
| amountIn | uint256 | exact amount of tokenIn to swap |
| minAmountOut | uint256 | minimal amount of tokenOut to receive |
| data | bytes | data for AdapterCallback |

### swapExactOutput

```solidity
function swapExactOutput(address recipient, address tokenIn, address tokenOut, uint256 maxAmountIn, uint256 amountOut, bytes data) external returns (uint256 amountIn)
```

swap with exact output

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | recipient of amountOut of tokenOut |
| tokenIn | address | address of a token to swap on dex |
| tokenOut | address | address of a token to receive from dex |
| maxAmountIn | uint256 | maximal amount of tokenIn to swap |
| amountOut | uint256 | exact amount of tokenOut to receive |
| data | bytes | data for AdapterCallback |

