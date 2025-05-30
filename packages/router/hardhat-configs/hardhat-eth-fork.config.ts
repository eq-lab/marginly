import '@nomicfoundation/hardhat-toolbox';
import 'solidity-docgen';
import * as defaultConfig from './hardhat.config';
import { config as dotEnvConfig } from 'dotenv';

dotEnvConfig();

const config = {
  ...defaultConfig.default,
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: process.env.ETHEREUM_RPC_URL,
        blockNumber: 21493100,
      },
    },
  },
};

export default config;
