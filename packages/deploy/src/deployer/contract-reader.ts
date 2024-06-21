import { ContractDescription, ContractReader } from '@marginly/common';

export function createMarginlyContractReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@marginly/contracts/artifacts/contracts/${name}.sol/${name}.json`);
  };
}

export function createKeeperContractReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@marginly/contracts/artifacts/contracts/keepers/${name}.sol/${name}.json`);
  };
}

export function createMarginlyMockContractReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@marginly/contracts/artifacts/contracts/test/${name}.sol/${name}.json`);
  };
}

export function createMarginlyPeripheryContractReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@marginly/periphery/artifacts/contracts/${name}.sol/${name}.json`);
  };
}

export function createMarginlyPeripheryOracleReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@marginly/periphery/artifacts/contracts/oracles/${name}.sol/${name}.json`);
  };
}

export function createMarginlyPeripheryMockContract(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@marginly/periphery/artifacts/contracts/test/${name}.sol/${name}.json`);
  };
}

export function createUniswapV3CoreInterfacesReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@uniswap/v3-core/artifacts/contracts/interfaces/${name}.sol/${name}.json`);
  };
}

export function createOpenzeppelinContractReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@openzeppelin/contracts/build/contracts/${name}.json`);
  };
}

export function createAaveContractReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@aave/core-v3/artifacts/contracts/interfaces/${name}.sol/${name}.json`);
  };
}
