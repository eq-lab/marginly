import { ContractStateDescription } from './index';
import { ethers } from 'ethers';
import { ContractsParams } from '../../connection';

export const erc20BalanceState: ContractStateDescription = {
  stateName: 'balance',
  valueUnits: 'Tokens',
  argsNames: ['account'],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    if (args.length !== 1) {
      console.error(`erc20BalanceState::fetchValue - invalid count of args`);
      return ['-'];
    }
    const balance = await contract.balanceOf(args[0]);
    const decimals = await contract.decimals();
    return [ethers.utils.formatUnits(balance, decimals)];
  },
};

export const erc20AllowanceState: ContractStateDescription = {
  stateName: 'allowance',
  valueUnits: 'Tokens',
  argsNames: ['owner', 'spender'],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    if (args.length !== 2) {
      console.error(`erc20AllowanceState::fetchValue - invalid count of args`);
      return ['-'];
    }
    const balance = await contract.allowance(args[0], args[1]);
    const decimals = await contract.decimals();
    return [ethers.utils.formatUnits(balance, decimals)];
  },
};

export const erc20StatesWithArgs = [erc20BalanceState, erc20AllowanceState];
