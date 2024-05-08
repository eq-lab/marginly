import '@nomicfoundation/hardhat-toolbox';
require('hardhat-contract-sizer');
import 'solidity-docgen';
import { config as dotEnvConfig } from 'dotenv';

dotEnvConfig();

const config = {
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
    },
  },
  paths: {
    root: '../',
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
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
    artioTestnet: {
      url: 'https://artio.rpc.berachain.com',
    },
    mainnet: {
      url: 'https://ethereum-rpc.publicnode.com',
    },
  },
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.API_KEY,
      artioTestnet: 'artio_testnet',
      mainnet: process.env.ETH_API_KEY,
    },
    customChains: [
      {
        network: 'artioTestnet',
        chainId: 80085,
        urls: {
          apiURL: 'https://api.routescan.io/v2/network/testnet/evm/80085/etherscan',
          browserURL: 'https://artio.beratrail.io',
        },
      },
    ],
  },
  mocha: {
    timeout: 200_000,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
    only: ['Marginly', 'SwapPoolRegistry', 'Oracle'],
    except: ['Mock', 'Test', 'Lib'],
  },
  docgen: {
    outputDir: '../docs',
    templates: '../../contracts/docgen-templates',
    clear: true,
    pages: 'files',
    exclude: ['test'],
  },
};

export default config;
