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

# compiles the ContestWinnerNft.sol smart-contract for a given $NETWORK
npx hardhat compile --network $NETWORK
```

### Deploy

```bash
cd packages/nft

# deploys the compiled ContestWinnerNft.sol smart-contract to a given $NETWORK
npx hardhat nft:deploy --signer $WALLET_PK --network $NETWORK

# verifies the deployed contract
npx hardhat nft:verify --contract $ADDRESS --network $NETWORK

```

### ContestWinnerNFT commands

```bash
# displays all the ContestWinnerNft.sol commands (note, it must have 'nft:' prefix)
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
