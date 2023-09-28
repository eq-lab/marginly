# Oracle for Uniswap Mock
Package with oracle service which sets prices for [Uniswap-mock](../contracts-uniswap-mock/)
## Build

```shell
cd <marginly_root_dir>
docker build -t marginly-oracle -f packages/oracle/Dockerfile .
```

## Run

```shell
docker run -e MARGINLY_ORACLE_ETHEREUM_ORACLE_PRIVATE_KEY=<oracle_private_key> <docker_image_hash>
```

You can set log format by defining environment variable:

```shell
MARGINLY_ORACLE_LOG_FORMAT=json
```

Supported formats are `text` and `json`.

By default, oracle reads config from `config.json` file.
You can change it by defining following environment variable:

```shell
MARGINLY_ORACLE_CONFIG_FILE=config-zk-testnet.json
```