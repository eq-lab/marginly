## KyberSwapElasticAdapter

### constructor

```solidity
constructor(struct PoolInput[] pools) public
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

### swapCallback

```solidity
function swapCallback(int256 deltaQty0, int256 deltaQty1, bytes data) external
```

## IKyberElasticPool

### swap

```solidity
function swap(address recipient, int256 swapQty, bool isToken0, uint160 limitSqrtP, bytes data) external returns (int256 amount0Delta, int256 amount1Delta)
```

