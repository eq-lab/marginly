import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
require('hardhat-contract-sizer');

const config = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
    },
  },
  gasReporter: {
    excludeContracts: [
      'MockAavePool',
      'MockAavePoolAddressesProvider',
      'MockERC20Token',
      'MockMarginlyPool',
      'MockSwapRouter',
    ],
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
    only: ['MarginlyKeeper'],
  },
};

export default config;
