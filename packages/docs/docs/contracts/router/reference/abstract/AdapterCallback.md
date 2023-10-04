## AdapterCallbackData

```solidity
struct AdapterCallbackData {
  address payer;
  address tokenIn;
  uint256 dexIndex;
}
```

## AdapterCallback

### adapterCallback

```solidity
function adapterCallback(address recipient, uint256 amount, bytes _data) external
```

this function can be called by known adapters only

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | to whom transfer the tokens from swap initiator |
| amount | uint256 | amount of tokens to transfer |
| _data | bytes |  |

