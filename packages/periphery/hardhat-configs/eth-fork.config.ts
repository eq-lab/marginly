import '@nomicfoundation/hardhat-toolbox';
import 'solidity-docgen';
import * as defaultConfig from './hardhat.config';

const config = {
  ...defaultConfig.default,
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: 'https://ethereum-rpc.publicnode.com',
        blockNumber: 21814800,
      },
    },
  },
};

export default config;
