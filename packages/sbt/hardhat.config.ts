import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import '@nomicfoundation/hardhat-ethers';
import '@matterlabs/hardhat-zksync-solc';
import '@matterlabs/hardhat-zksync-verify';
import 'hardhat-gas-reporter';
require('hardhat-contract-sizer');

import './scripts';
import { config } from './hardhat.common';

export default config;
