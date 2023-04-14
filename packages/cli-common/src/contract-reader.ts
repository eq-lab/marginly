import * as ethers from 'ethers';
import * as path from 'path';
import fs from 'fs';

export interface ContractDescription {
  abi: ethers.utils.Interface;
  bytecode: string;
}

export type ContractReader = (name: string) => ContractDescription;

export const createContractReader =
  (contractRoot: string) =>
  (name: string): ContractDescription => {
    return JSON.parse(fs.readFileSync(`${contractRoot}${path.sep}${name}.json`, 'utf-8'));
  };
