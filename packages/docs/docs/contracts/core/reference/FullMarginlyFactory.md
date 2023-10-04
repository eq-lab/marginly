## FullMarginlyFactory

Deploys Marginly and manages ownership and control over pool

### uniswapFactory

  ```solidity
  address uniswapFactory
  ```

Address of uniswap factory

### swapRouter

  ```solidity
  address swapRouter
  ```

Address of uniswap swap router

### feeHolder

  ```solidity
  address feeHolder
  ```

Swap fee holder

### WETH9

  ```solidity
  address WETH9
  ```

Address of wrapped ETH

### techPositionOwner

  ```solidity
  address techPositionOwner
  ```

Technical position address

### getPool

  ```solidity
  mapping(address => mapping(address => mapping(uint24 => address))) getPool
  ```

Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist

  _quoteToken and baseToken may be passed in either token0/token1 or token1/token0 order_

### constructor

```solidity
constructor(address _uniswapFactory, address _swapRouter, address _feeHolder, address _WETH9, address _techPositionOwner) public
```

### createPool

```solidity
function createPool(address quoteToken, address baseToken, uint24 uniswapFee, struct MarginlyParams params) external returns (address pool)
```

Creates a pool for the two given tokens and fee

_tokenA and tokenB may be passed in either order: token0/token1 or token1/token0. tickSpacing is retrieved
from the fee. The call will revert if the pool already exists, the fee is invalid, or the token arguments
are invalid._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| quoteToken | address | One of the two tokens in the desired pool |
| baseToken | address | The other of the two tokens in the desired pool |
| uniswapFee | uint24 | Fee for uniswap pool |
| params | struct MarginlyParams | pool parameters |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the newly created pool |

### changeSwapRouter

```solidity
function changeSwapRouter(address newSwapRouter) external
```

Changes swap router address used by Marginly pools

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newSwapRouter | address | address of new swap router |

