# Marginly periphery smart contracts

## `MarginlyAdmin.sol`
Proxy contract for creation and administration of Marginly pools.
Anyone can create a new Marginly Pool by using the `createPool` method. 
The creator will be granted owner rights and can control the pool with these methods:
- `setParameters` - update [pool parameters](../contracts/contracts/dataTypes/MarginlyParams.sol)
- `shutDown` - switch Marginly pool to [emergency mode](../contracts/contracts/dataTypes/Mode.sol)
- `sweepETH` - withdraw ETH coins

## Install dependencies

```
yarn install
```

## Compilation

```bash
yarn compile
```

## Run unit tests
```bash
yarn test
```