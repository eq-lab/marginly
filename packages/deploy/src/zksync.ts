import { Artifact, HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployer } from "@matterlabs/hardhat-zksync-deploy/dist/deployer";
import { Wallet } from "zksync-web3";

function readOpenzeppelinTokenContract(name: string): Artifact {
  return require(`@marginly/contracts-uniswap-mock/artifacts-zk/@openzeppelin/contracts/token/${name}.sol/${name}.json`);
}

function readUniswapMockContract(name: string): Artifact {
  return require(`@marginly/contracts-uniswap-mock/artifacts-zk/contracts/${name}.sol/${name}.json`);
}

function readMarginlyContract(name: string): Artifact {
  return require(`@marginly/contracts/artifacts-zk/contracts/${name}.sol/${name}.json`);
}

function readMarginlyMockContract(name: string): Artifact {
  return require(`@marginly/contracts/artifacts-zk/contracts/test/${name}.sol/${name}.json`);
}

function readUniswapV3CoreInterface(name: string): Artifact {
  return require(`@marginly/contracts/artifacts-zk/@uniswap/v3-core/contracts/interfaces/${name}.sol/${name}.json`);
}

function readAaveContract(name: string): Artifact {
  return require(`@marginly/contracts/artifacts-zk/@aave/core-v3/contracts/interfaces/${name}.sol/${name}.json`);
}

const hreMock = {
  network: {
    name: 'default',
    zksync: true,
    config: {
      url: "http://localhost:3050",
      ethNetwork: "http://localhost:8545",
      zksync: true,
    }
  },
  config: {
    networks: {
      default: {
        url: "http://localhost:3050",
        ethNetwork: "http://localhost:8545",
        zksync: true,
      },
    }
  },
  artifacts: {
    async readArtifact(contractName: string): Promise<Artifact> {
      if (contractName === 'contracts/MarginlyPool.sol:MarginlyPool') {
        contractName = 'MarginlyPool';
      }

      switch (contractName) {
        case 'WETH9':
        case 'MintableToken':
        case 'UniswapV3PoolMock':
        case 'SwapRouterMock':
          return readUniswapMockContract(contractName);
        case 'IERC20Metadata':
          return readOpenzeppelinTokenContract(contractName);
        case 'MarginlyPool':
        case 'MarginlyFactory':
        case 'MarginlyKeeper':
          return readMarginlyContract(contractName);
        case 'MockAavePool':
        case 'MockAavePoolAddressesProvider':
          return readMarginlyMockContract(contractName);
        case 'IUniswapV3Pool':
        case 'IUniswapV3Factory':
          return readUniswapV3CoreInterface(contractName);
        case 'IPoolAddressesProvider':
          return readAaveContract(contractName);
        default:
          throw new Error(`Unknown contract ${contractName}`);
      }
    }
  }
}

export function createDeployer(wallet: Wallet) {
  return new Deployer(hreMock as unknown as HardhatRuntimeEnvironment, wallet);
}