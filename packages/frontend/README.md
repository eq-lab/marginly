# Marginly Dev frontend

### Install dependencies:

```bash
yarn install
```

### Run

```bash
yarn start
```

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any errors in the console.

### Signers

There are two types of signers:

- with raw seed
- unlocked by Ganache

File `frontend/src/signers.json` contains a list of available signers. You can append a new one to this list to send transactions from the desired account.

### How to connect to contract

On top of [http://localhost:3000](http://localhost:3000), you can see `Connection settings` section.

You need to input the node address, and MarginlyPool contract address and select one of the available signers
(note, that you can use an unlocked account only with a fork).
After all, press the `Connect` button.
Quote and base tokens contracts will be fetched from the pool and displayed on relevant fields.

Parameters `gasLimit`, `gasPrice`, and `signer` can be changed at any time without reconnection.

### How to add support for a new contract method or state

#### Methods

The list of all available to call contracts methods is placed here:
`frontend/src/contracts/calls`.

To add a new one you need to implement `ContractMethodDescription` and add it to `marginlyPoolMethods` list

#### States

The list of all available contracts states is placed here:
`frontend/src/contracts/states`.

To add a new one you need to implement `ContractStateDescription` and add it to one of the lists: `marginlyPoolStatesWithArgs` or `marginlyPoolStatesWithoutArgs`
