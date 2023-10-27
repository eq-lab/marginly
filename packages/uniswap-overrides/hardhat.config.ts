import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
require('hardhat-contract-sizer');

const config = {
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 100_000,
      },
    },
  },
  networks: {
    polygonMumbai: {
      url: 'https://rpc.ankr.com/polygon_mumbai',
    },
    arbitrumGoerli: {
      url: 'https://goerli-rollup.arbitrum.io/rpc',
    },
    arbitrumOne: {
      url: 'https://arb1.arbitrum.io/rpc',
    },
  },
  etherscan: {
    apiKey: process.env.API_KEY,
  },
  mocha: {
    timeout: 200_000,
  },
  gasReporter: {
    excludeContracts: [],
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
    only: ['UniswapV3FactoryOverride'],
  },
};

export default config;
