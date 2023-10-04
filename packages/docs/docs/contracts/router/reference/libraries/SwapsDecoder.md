## SwapsDecoder

### SwapInfo

```solidity
struct SwapInfo {
  uint16 dexIndex;
  uint256 dexAmountIn;
  uint256 dexAmountOut;
}
```

### WrongSwapsNumber

```solidity
error WrongSwapsNumber()
```

### WrongSwapRatios

```solidity
error WrongSwapRatios()
```

### MASK

```solidity
uint256 MASK
```

### SWAP_NUMBER_MASK

```solidity
uint256 SWAP_NUMBER_MASK
```

### ONE

```solidity
uint256 ONE
```

### decodeSwapInfo

```solidity
function decodeSwapInfo(uint256 encodedSwaps, uint256 amountIn, uint256 amountOut) internal pure returns (struct SwapsDecoder.SwapInfo[] swapInfos)
```

_encodedSwaps param structure:
last 4 bits: total number of swaps
then swaps as groups of 22 bits
the first 6 out of 22 bits represent dexIndex
the rest 16 out of 22 bits represent swap ratio_

