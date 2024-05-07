import '@nomicfoundation/hardhat-toolbox';
import 'solidity-docgen';
import * as defaultConfig from './hardhat.config';

const config = {
  ...defaultConfig.default,
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: 'https://arb1.arbitrum.io/rpc',
        blockNumber: 208704305,
      },
    },
  },
};

export default config;
