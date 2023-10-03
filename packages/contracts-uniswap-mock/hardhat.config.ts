import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
require('hardhat-contract-sizer');

const config = {
  solidity: {
    compilers: [
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
      {
        version: '0.4.18',
        settings: {
          optimizer: {
            enabled: false,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    polygonMumbai: {
      url: 'https://rpc.ankr.com/polygon_mumbai',
    },
    arbitrumGoerli: {
      url: 'https://goerli-rollup.arbitrum.io/rpc',
    },
  },
  etherscan: {
    apiKey: {
      polygonMumbai: process.env.API_KEY,
      arbitrumGoerli: process.env.API_KEY,
    },
  },
  mocha: {
    timeout: 200_000,
  },
  gasReporter: {
    excludeContracts: ['TestERC20', 'TestUniswapFactory', 'TestUniswapPool', 'ERC20'],
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
    only: ['Marginly'],
  },
};

export default config;
