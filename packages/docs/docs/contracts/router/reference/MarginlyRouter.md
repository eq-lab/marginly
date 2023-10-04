## MarginlyRouter

### constructor

```solidity
constructor(struct AdapterInput[] _adapters) public
```

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

