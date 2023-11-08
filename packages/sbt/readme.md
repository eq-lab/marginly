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

### Data

```bash
# NFTs for Marginly contest #1 winners conducted in Arbitrum network
data/marginly-contests/#1

# NFTs for Marginly contest #2 winners conducted in zkSync network
data/marginly-contests/#2

# JSON containing the winners of the contests
data/marginly-contests/token-winners.json

# JSON containing the NFTs metadata
data/marginly-contests/tokens-metadata.json
```
