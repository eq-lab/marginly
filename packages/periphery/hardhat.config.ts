import '@nomicfoundation/hardhat-toolbox';
require('hardhat-contract-sizer');
import 'solidity-docgen';

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
      polygonMumbai: '',
      arbitrumGoerli: '',
    },
  },
  mocha: {
    timeout: 200_000,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
    only: ['Marginly'],
    except: ['Mock', 'Test'],
  },
  docgen: {
    outputDir: './docs',
    templates: '../contracts/docgen-templates',
    clear: true,
    pages: 'files',
    exclude: ['test'],
  },
};

export default config;
