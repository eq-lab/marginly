import * as ethers from 'ethers';

export interface ContractDescription {
  abi: ethers.utils.Interface;
  bytecode: string;
}

export type ContractReader = (name: string) => ContractDescription;
