import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import '@nomicfoundation/hardhat-ethers';
import '@matterlabs/hardhat-zksync-solc';
import '@matterlabs/hardhat-zksync-verify';
require('hardhat-contract-sizer');

export const config = {
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
    },
  },
  networks: {
    zkSyncGoerli: {
      url: 'https://testnet.era.zksync.dev',
      verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification',
      ethNetwork: 'goerli',
      zksync: true,
    },
    zkSyncMainnet: {
      url: 'https://mainnet.era.zksync.io',
      verifyURL: 'https://zksync2-mainnet-explorer.zksync.io/contract_verification',
      ethNetwork: 'mainnet',
      zksync: true,
    },
    arbitrumGoerli: {
      url: 'https://goerli-rollup.arbitrum.io/rpc',
      zksync: false,
    },
    arbitrumMainnet: {
      url: 'https://arb1.arbitrum.io/rpc',
      zksync: false,
    },
  },
  etherscan: {
    apiKey: {
      arbitrumGoerli: 'CGWUYWEHU1KUKNHG9HJSEHT94W3F31M834',
      arbitrumMainnet: 'CGWUYWEHU1KUKNHG9HJSEHT94W3F31M834',
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
    only: ['ContestWinnerNFT'],
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
