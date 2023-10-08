# Soulbound token

### Supported networks

```bash
# the list of all supported networks
$NETWORK = {
  zkSyncGoerli,
  zkSyncMainnet,
  arbitrumGoerli,
  arbitrumMainnet
}
```

### Build

```bash
# installs all the dependencies and builds them
yarn install && yarn build

# compiles the SBT smart-contract for a given $NETWORK
npx hardhat compile --network $NETWORK
```

### Deploy

```bash
cd packages/sbt

# deploys the compiled SBT smart-contract to a given $NETWORK
npx hardhat sbt:deploy --signer $WALLET_PK --network $NETWORK

# verifies the deployed contract
npx hardhat sbt:verify --contract $ADDRESS --network $NETWORK

```

### SBT commands

```bash
# displays all the SBT commands (note, it must have 'sbt:' prefix)
npx hardhat --help

# displays help for a given command
npx hardhat $COMMAND --help
```
