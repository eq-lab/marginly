import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer';
import * as defaultConfig from './hardhat.common';
import './tasks/timelock';
import { config as dotEnvConfig } from 'dotenv';

dotEnvConfig();

const config = {
  ...defaultConfig.default,
  networks: {
    arbitrum: {
      url: 'https://arb1.arbitrum.io/rpc',
    },
    ethereum: {
      url: process.env.ETH_RPC_URL,
    },
    holesky: {
      url: 'https://1rpc.io/holesky',
    },
  },
};

export default config;
