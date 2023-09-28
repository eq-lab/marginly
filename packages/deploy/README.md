# Marginly deploy
This package implements deployment of marginly contracts.
However to run the deployment use [`cli` package](../cli/README.md).

## Install

```shell
yarn install
```

## Build

```shell
yarn build
```
## Deployment config files

Config files general structure is described in `src/config.ts` file.

### systemContextDefaults
Defines node uri to be used in deployment

### connection
#### assertChainId
(optional) Defines chainId to compare with chainId returned by node uri.
#### ethOptions
Contains optional fields `gasPrice` and `gasLimit` to use with every deployment transaction.

### tokens
There can be 2 types of token: `mintable` or `existing` (the latter one may be skipped).
The `existing` token defines the token which is already deployed and widely used (WETH9/USDC as example).
The `mintable` on the other hand describes a new token to be deployed and must be used for test purposes only.

### prices
NEEDED for `mintable` tokens and testing purposes only, otherwise should be empty.
Defines price source query to be used by oracle for uniswapV3 pool mocks.

### uniswap
Defines either known UniswapV3 pools or their mocks to be deployed. The latter ones are for testing purposes only.
#### type
Either `mock` or `genuine` (may be skipped for the latter one). Use mock for testing purposes only. 
#### oracle
NEEDED for `mock` type ONLY. Address of oracle from which pool gets prices.

### marginlyFactory
Parameters of marginlyFactory deployment.
#### fee holder
Address where all swap-fee are transferred.
#### techPositionOwner
Address of techPosition in every Marginly pool.
#### wethTokenId
Id of WETH9 in `tokens` chapter. Needed for wrapping and unwrapping of Ethereum.

### marginlyPools
Array of marginlyPools to be created by factory. Defines `MarginlyParams` from `@marginly/contracts/contracts/dataTypes/MarginlyParams.sol`.

### adapters
Array of adapters to deploy with router
#### dexId
Id for (id => adapter) mapping in router
#### adapterName
Filename with solidity code of an adapter to be used in deployment. It must be located in `@marginly/router/contracts/adapters/{adapterName}.sol`
#### pools
Array of pools to which this adapter can route swaps.

### marginlyKeeper
Defines keeper contract.
#### aavePoolAddressesProvider
Address of aave pool to be used by keeper contract.


See example files in `src/data/deploy/examples` directory