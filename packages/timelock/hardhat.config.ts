import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer';
import * as defaultConfig from './hardhat.common';
import './tasks/timelock';

const config = {
  ...defaultConfig.default,
  networks: {
    arbitrum: {
      url: 'https://arb1.arbitrum.io/rpc',
    },
    ethereum: {
      url: 'https://rpc.ankr.com/eth',
    },
    holesky: {
      url: 'https://1rpc.io/holesky',
    },
  },
};

export default config;
