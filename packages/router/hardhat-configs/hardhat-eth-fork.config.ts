import '@nomicfoundation/hardhat-toolbox';
import 'solidity-docgen';
import * as defaultConfig from './hardhat.config';

const config = {
  ...defaultConfig.default,
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: 'https://rpc.ankr.com/eth',
        blockNumber: 21493100,
      },
    },
  },
};

export default config;
