# Soulbound token
Package with souldbound token implementation used for Marginly d contests.
### Build
```bash
yarn install && yarn build
```

### Deploy
```bash
cd data/deploy/testnet/bsc

node ../../../../../cli/dist/index.js deploy \
  --dry-run \
  --dry-run-opts fund \
  --eth-node-uri <nodeUri> \
  --eth-key-type 'raw' \
  --eth-key <ethPrivateKey> \
  sbt \
    --state-mode 'new'
```