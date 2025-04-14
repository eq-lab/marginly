import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer';
import { config as dotEnvConfig } from 'dotenv';

dotEnvConfig();

const config: HardhatUserConfig & { contractSizer: any } = {
  solidity: {
    compilers: [
      {
        version: '0.8.27',
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
        },
      },
    ],
  },
  etherscan: {
    apiKey: {
      ethereum: process.env.API_KEY,
      sonic: process.env.SONIC_API_KEY,
    },
    customChains: [
      {
        network: 'sonic',
        chainId: 146,
        urls: {
          apiURL: 'https://api.sonicscan.org/api',
          browserURL: 'https://sonicscan.org',
        },
      },
    ],
  },
  mocha: {
    timeout: 2_000_000,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
    only: ['TimelockWhitelist'],
    except: ['Mock', 'Test'],
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
