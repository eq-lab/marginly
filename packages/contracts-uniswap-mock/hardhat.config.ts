import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import { config as dotEnvConfig } from 'dotenv';
import './scripts';

require('hardhat-contract-sizer');
dotEnvConfig();

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
    arbitrumSepolia: {
      url: 'https://sepolia-rollup.arbitrum.io/rpc',
    },
    x1Testnet: {
      url: 'https://x1-testnet.blockpi.network/v1/rpc/public',
    },
    blastSepolia: {
      url: 'https://sepolia.blast.io',
    },
  },
  etherscan: {
    apiKey: {
      polygonMumbai: process.env.API_KEY,
      arbitrumGoerli: process.env.API_KEY,
      arbitrumSepolia: process.env.API_KEY,
      x1Testnet: process.env.API_KEY,
      blastSepolia: 'blast_sepolia',
    },
    customChains: [
      {
        network: 'arbitrumSepolia',
        chainId: 421614,
        urls: {
          apiURL: 'https://api-sepolia.arbiscan.io/api',
          browserURL: 'https://sepolia.arbiscan.io/',
        },
      },
      {
        network: 'x1Testnet',
        chainId: 195,
        urls: {
          browserURL: 'https://www.okx.com/explorer/x1-test/',
        },
      },
      {
        network: 'blastSepolia',
        chainId: 168587773,
        urls: {
          apiURL: 'https://api.routescan.io/v2/network/testnet/evm/168587773/etherscan',
          browserURL: 'https://testnet.blastscan.io',
        },
      },
    ],
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
