## MarginlyPool

### factory

  ```solidity
  address factory
  ```

Returns address of Marginly factory

### quoteToken

  ```solidity
  address quoteToken
  ```

Returns the address of quote token from pool

### baseToken

  ```solidity
  address baseToken
  ```

Returns the address of base token from pool

### uniswapPool

  ```solidity
  address uniswapPool
  ```

Returns the address of associated uniswap pool

### mode

  ```solidity
  enum Mode mode
  ```

### params

  ```solidity
  struct MarginlyParams params
  ```

### discountedQuoteCollateral

  ```solidity
  uint256 discountedQuoteCollateral
  ```

  _Sum of all quote token in collateral_

### discountedQuoteDebt

  ```solidity
  uint256 discountedQuoteDebt
  ```

  _Sum of all quote token in debt_

### discountedBaseCollateral

  ```solidity
  uint256 discountedBaseCollateral
  ```

  _Sum of  all base token collateral_

### discountedBaseDebt

  ```solidity
  uint256 discountedBaseDebt
  ```

  _Sum of all base token in debt_

### lastReinitTimestampSeconds

  ```solidity
  uint256 lastReinitTimestampSeconds
  ```

  _Timestamp of last reinit execution_

### baseCollateralCoeff

  ```solidity
  struct FP96.FixedPoint baseCollateralCoeff
  ```

  _Aggregate for base collateral time change calculations_

### baseDelevCoeff

  ```solidity
  struct FP96.FixedPoint baseDelevCoeff
  ```

  _Aggregate for deleveraged base collateral_

### baseDebtCoeff

  ```solidity
  struct FP96.FixedPoint baseDebtCoeff
  ```

  _Aggregate for base debt time change calculations_

### quoteCollateralCoeff

  ```solidity
  struct FP96.FixedPoint quoteCollateralCoeff
  ```

  _Aggregate for quote collateral time change calculations_

### quoteDelevCoeff

  ```solidity
  struct FP96.FixedPoint quoteDelevCoeff
  ```

  _Aggregate for deleveraged quote collateral_

### quoteDebtCoeff

  ```solidity
  struct FP96.FixedPoint quoteDebtCoeff
  ```

  _Accrued interest rate and fee for quote debt_

### initialPrice

  ```solidity
  struct FP96.FixedPoint initialPrice
  ```

  _Initial price. Used to sort key and shutdown calculations. Value gets reset for the latter one_

### emergencyWithdrawCoeff

  ```solidity
  struct FP96.FixedPoint emergencyWithdrawCoeff
  ```

  _Ratio of best side collaterals before and after margin call of opposite side in shutdown mode_

### Leverage

```solidity
struct Leverage {
  uint128 shortX96;
  uint128 longX96;
}
```

### systemLeverage

  ```solidity
  struct MarginlyPool.Leverage systemLeverage
  ```

### positions

  ```solidity
  mapping(address => struct Position) positions
  ```

users positions

### constructor

```solidity
constructor() public
```

### _initializeMarginlyPool

```solidity
function _initializeMarginlyPool(address _quoteToken, address _baseToken, bool _quoteTokenIsToken0, address _uniswapPool, struct MarginlyParams _params) internal
```

### initialize

```solidity
function initialize(address _quoteToken, address _baseToken, bool _quoteTokenIsToken0, address _uniswapPool, struct MarginlyParams _params) external virtual
```

_Initializes the pool_

### receive

```solidity
receive() external payable
```

### lock

```solidity
modifier lock()
```

_Protects against reentrancy_

### onlyFactoryOwner

```solidity
modifier onlyFactoryOwner()
```

### setParameters

```solidity
function setParameters(struct MarginlyParams _params) external
```

Sets the pool parameters. May only be called by the pool owner

### getBasePrice

```solidity
function getBasePrice() public view returns (struct FP96.FixedPoint)
```

Get oracle price baseToken / quoteToken

### getLiquidationPrice

```solidity
function getLiquidationPrice() public view returns (struct FP96.FixedPoint)
```

Get TWAP price used in mc slippage calculations

### shutDown

```solidity
function shutDown(uint256 swapCalldata) external
```

Switch to emergency mode when collateral of any side not enough to cover debt

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| swapCalldata | uint256 | router calldata for splitting swap to reduce potential sandwich attacks impact |

### sweepETH

```solidity
function sweepETH() external
```

Sweep ETH balance of contract

### getHeapPosition

```solidity
function getHeapPosition(uint32 index, bool _short) external view returns (bool success, struct MaxBinaryHeapLib.Node)
```

_Used by keeper service_

### execute

```solidity
function execute(enum CallType call, uint256 amount1, uint256 amount2, uint256 limitPriceX96, bool flag, address receivePositionAddress, uint256 swapCalldata) external payable
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| call | enum CallType |  |
| amount1 | uint256 |  |
| amount2 | uint256 |  |
| limitPriceX96 | uint256 |  |
| flag | bool | unwrapETH in case of withdraw calls or syncBalance in case of reinit call |
| receivePositionAddress | address |  |
| swapCalldata | uint256 |  |

### getTimestamp

```solidity
function getTimestamp() internal view virtual returns (uint256)
```

