import { ethers } from 'ethers';
import { ContractsParams } from '../../connection';

export type ContractStateDescription = {
  stateName: string;
  argsNames: string[];
  valueUnits: string;
  fetchValue: (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    contractsContext: ContractsParams
  ) => Promise<string[]>;
};
