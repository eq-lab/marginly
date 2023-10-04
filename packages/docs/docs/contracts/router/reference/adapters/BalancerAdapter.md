## BalancerAdapter

### balancerVault

```solidity
address balancerVault
```

### constructor

```solidity
constructor(struct PoolInput[] pools, address _balancerVault) public
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

## FundManagement

```solidity
struct FundManagement {
  address sender;
  bool fromInternalBalance;
  address payable recipient;
  bool toInternalBalance;
}
```

## SingleSwap

```solidity
struct SingleSwap {
  bytes32 poolId;
  enum SwapKind kind;
  contract IAsset assetIn;
  contract IAsset assetOut;
  uint256 amount;
  bytes userData;
}
```

## SwapKind

```solidity
enum SwapKind {
  GIVEN_IN,
  GIVEN_OUT
}
```

## IVault

### swap

```solidity
function swap(struct SingleSwap singleSwap, struct FundManagement funds, uint256 limit, uint256 deadline) external payable returns (uint256)
```

## IAsset

## IBasePool

### getPoolId

```solidity
function getPoolId() external view returns (bytes32)
```

