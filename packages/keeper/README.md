# Marginly keeper service

Service for monitor and liquidate bad positions with help of MarginlyKeeper contract

## Install dependencies

```shell
yarn
```

## Build

```shell
yarn build
```

## Prepare config

Provide actual nodeUri, address of MarginlyKeeper contract and target pools.

Example of config.

```json
{
  "systemContextDefaults": {
    "ethNodeUri": "https://ethereum-mainnet-rpc.allthatnode.com"
  },
  "connection": {
    "ethOptions": {
      "gasPrice": 700000
    }
  },
  "keeperAddress": "0x003E10B715bF75dC0a956d586e0e7CA6D8f2f234",
  "marginlyPools": [
    {
      "address": "0x003E10B715bF75dC0a956d586e0e7CA6D8f2f234",
      "minProfitQuote": "200",
      "minProfitBase": "0.15"
    }
  ]
}
```

## Run

```shell
node dist/index.js --config <path to config.json>\
    --eth-key <private key>
```

Alternatively you can provide private key as a file

```shell
node dist/index.js --config <path to config.json>\
    --eth-key-type 'json'\
    --eth-key-file <path to your json wallet>
```

or provide private key interactively in terminal

```shell
node dist/index.js --config <path to config.json>
```

## Docker

Build

```shell
docker build -t marginly-keeper -f packages/keeper/Dockerfile .
```

run

```shell
docker run -e MARGINLY_KEEPER_CONFIG=config.arbitrum-one.json -e MARGINLY_KEEPER_LOG_LEVEL=1 -e MARGINLY_KEEPER_LOG_FORMAT=text -e MARGINLY_KEEPER_ETH_KEY=<private_key> marginly-keeper
```
