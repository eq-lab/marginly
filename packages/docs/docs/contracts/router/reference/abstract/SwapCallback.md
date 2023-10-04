## CallbackData

```solidity
struct CallbackData {
  address tokenIn;
  address tokenOut;
  address initiator;
  bytes data;
}
```

## SwapCallback

### swapCallbackInner

```solidity
function swapCallbackInner(int256 amount0Delta, int256 amount1Delta, bytes _data) internal
```

