## PositionType

```solidity
enum PositionType {
  Uninitialized,
  Lend,
  Short,
  Long
}
```

## Position

```solidity
struct Position {
  enum PositionType _type;
  uint32 heapPosition;
  uint256 discountedBaseAmount;
  uint256 discountedQuoteAmount;
}
```

