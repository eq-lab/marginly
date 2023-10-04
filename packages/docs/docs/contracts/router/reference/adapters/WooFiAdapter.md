## WooFiAdapter

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
function swapExactOutput(address, address, address, uint256, uint256, bytes) external pure returns (uint256)
```

## IWooPoolV2

### swap

```solidity
function swap(address fromToken, address toToken, uint256 fromAmount, uint256 minToAmount, address to, address rebateTo) external returns (uint256 realToAmount)
```

