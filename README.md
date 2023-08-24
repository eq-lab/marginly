![Logo](https://www.gitbook.com/cdn-cgi/image/width=256,dpr=2,height=40,fit=contain,format=auto/https%3A%2F%2F817273339-files.gitbook.io%2F~%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FQiFBW4qPpAjrKQaezZ3s%252Flogo%252FOc3PF8jhGWKJtyrvvF9r%252FMarginly-Logotype.png%3Falt%3Dmedia%26token%3D258404b4-55fc-41d0-b6d4-daee903b5a7b)

## What is Marginly ?

Marginly is a decentralized lending protocol that allows users to take up to 20x leveraged long and short positions on crypto-assets

For the initial version of Marginly we want to keep it simple and prove a concept of the protocol and its efficiency. Marginly v1 will be limited to one uniswap pool per blockchain.
The team will aim to scale the protocol across all of the blockchain networks where the Uniswap v3 protocol is currently present, so one might expect to see following network and pools appear inside the protocol relatively fast.

Visit https://docs.marginly.com for more information

## Repository overview

This monorepository contains packages with smart contracts source code, deploy tools and deploy configurations, dev frontend and integration tests

### contracts

Smart contracts of the Marginly pool. It uses Hardhat for development environment for compilation and unit-testing. [More information](./packages/contracts/README.md)

### router

Smart contracts of the router. It uses Hardhat for development environment for compilation and unit-testing. [More information](./packages/router/README.md)

### cli

The command line interface for deploying smart contracts. [More information how to deploy](./packages/cli/README.md)

### deploy

The package contains library for deploying smart contracts and deploy configuration.

### int-tests

This package contains integration tests. It create mainnet fork for every test and uses Ganache as a network emulator. [More information](./packages/int-tests/README.md)

### frontend

The package contains simple frontend interacting with the protocol smart contracts and also scripts to run network with test accounts. [More information](./packages/frontend/README.md)

## Licensing

The primary license for Marginly protocol is the [Business Source License 1.1 (BUSL-1.1)](./LICENSE).

All files in folders _contracts/dataTypes_ and _contracts/interfaces_ licensed under [GNU General Public License v2.0 (GNU GPL 2.0)](./packages/contracts/contracts/interfaces/LICENSE).

Files in folder _contracts/libraries_ licensed under [GNU General Public License v2.0 (GNU GPL 2.0)](./packages/contracts/contracts/libraries/LICENSE), [Business Source License 1.1 (BUSL-1.1)](./LICENSE) and [MIT License (MIT)](./packages/contracts/contracts/libraries/LICENSE_MIT)
