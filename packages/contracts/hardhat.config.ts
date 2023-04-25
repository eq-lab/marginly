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
  mocha: {
    timeout: 200_000,
  },
  gasReporter: {
    excludeContracts: [
      'TestERC20',
      'TestUniswapFactory',
      'TestUniswapPool',
      'ERC20',
      'MockAavePool',
      'MockAavePoolAddressesProvider',
      'MockMarginlyPool',
      'MockSwapRouter',
    ],
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
    only: ['Marginly'],
    except: ['Mock', 'Test'],
  },
};

export default config;
