## FullMarginlyPool

### constructor

```solidity
constructor(address _quoteToken, address _baseToken, bool _quoteTokenIsToken0, address _uniswapPool, struct MarginlyParams _params) public
```

### initialize

```solidity
function initialize(address _quoteToken, address _baseToken, bool _quoteTokenIsToken0, address _uniswapPool, struct MarginlyParams _params) external
```

_Initializes the pool_

### getParams

```solidity
function getParams() external view returns (uint8 maxLeverage, uint16 priceSecondsAgo, uint16 priceSecondsAgoMC, uint24 interestRate, uint24 swapFee, uint24 mcSlippage, uint184 positionMinAmount, uint184 quoteLimit)
```

