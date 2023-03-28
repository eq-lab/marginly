import { ethers } from 'ethers';
import { ContractsParams } from '../../connection';

export type ContractMethodDescription = {
  methodName: string;
  argsNames: string[];
  callHandler: (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    contractsContext: ContractsParams
  ) => Promise<void>;
};
