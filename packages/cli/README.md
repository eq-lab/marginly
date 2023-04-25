# Marginly CLI

## Install

```shell
yarn install
```

## Build

```shell
yarn build
```

## Deploy

To deploy contracts first you need to create directory
somewhere and place `config.json` file in it.
This file describes deploy scenario.

See examples in `packages/deploy/src/data/deploy/goerli` and `packages/deploy/src/data/deploy/ethereum`.

### Run Deploy from CLI

Go to the cli package directory and build it:

```shell
cd packages/cli
yarn build
```

Go to the deployment directory:
```shell
cd ../deploy/src/data/deploy/goerli/
```

Check that deployment is ok by running it on fork
using option `--dry-run`:
```shell
node ../../../../../cli/dist/index.js \
  deploy \
    --dry-run \
    --eth-key-type 'json' \
    --eth-key-file <path to your json wallet> \
    marginly \
      --state-mode new
```

It does not change deployment directory contents and
does not actually deploy anything. But you may
see some errors while run that you can safely fix.

After you dry run deployment succeeds. You can remove
`--dry-run` option to perform actual deploy:

```shell
node ../../../../../cli/dist/index.js \
  deploy \
    --eth-key-type 'json' \
    --eth-key-file <path to your json wallet> \
    marginly \
      --state-mode new
```

After deployment process start state file will be created
in the `states` subdirectory. It will be called something
like `2023-01-20.json`. This file contains all contract
addresses and their transaction hashes for deployed contracts.

If deployment fails for some reason you can continue
deployment from the same place it was interrupted by
using `--state-mode latest` command line argument:

```shell
node ../../../../../cli/dist/index.js \
  deploy \
    --eth-key-type 'json' \
    --eth-key-file <path to your json wallet> \
    marginly \
      --state-mode latest
```

After successful deployment in the deployment directory
will be created file `deployment.json`. It contents
should be something like this:

```json
{
  "marginlyPools": [
    {
      "id": "usdc-weth",
      "address": "0x374b40309E82D80441A5384a0044BA04AA97295d"
    }
  ]
}
```

This file can be used by external tools to operate on
deployed Marginly Pool contracts.

## Deployer Credential Formats

CLI utility supports deployer accounts in various formats.

You can pass private key using `--eth-key` argument.
This method is the simplest one but insecure.
```shell
node ../../../../../cli/dist/index.js \
  deploy \
    --eth-key <your private key> \
    marginly \
      --state-mode new
```

You can slightly improve security by entering your
private key interactively. To do it, omit
passing account credentials entirely:

```shell
node ../../../../../cli/dist/index.js \
  deploy \
    marginly \
      --state-mode new
```
CLI will prompt you to enter private key:
```
? ethKey › <enter your private key here>
```

Improve security one step further by using json wallet:
```shell
node ../../../../../cli/dist/index.js \
  deploy \
    --eth-key-type 'json' \
    --eth-key-file <path to your json wallet> \
    marginly \
      --state-mode new
```

CLI will ask you password:
```
? ethKeyPassword › <enter your json wallet password here>
```

For the best security you can use Ledger hardware wallet:
```shell
node ../../../../../cli/dist/index.js \
  deploy \
    --eth-key-type 'ledger' \
    --eth-key <deviation path> \
    marginly \
      --state-mode new
```
