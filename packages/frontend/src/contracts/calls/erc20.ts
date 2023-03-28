import { ContractMethodDescription } from './index';
import { ethers } from 'ethers';
import { sendTransaction } from './common';
import { ContractsParams } from '../../connection';

export const approveCall: ContractMethodDescription = {
  methodName: 'approve',
  argsNames: ['spender', 'amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 2) {
      console.error(`approveCall: invalid count of args`);
      return;
    }
    const [spender, amount] = args;
    const decimals = await contract.decimals();
    await sendTransaction(
      contract,
      signer,
      'approve',
      [spender, ethers.utils.parseUnits(amount, decimals).toString()],
      gasLimit,
      gasPrice
    );
  },
};

const transferCall: ContractMethodDescription = {
  methodName: 'transfer',
  argsNames: ['recipient', 'amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 2) {
      console.error(`transferCall: invalid count of args`);
      return;
    }
    await sendTransaction(contract, signer, 'transfer', args, gasLimit, gasPrice);
  },
};

export const depositCall: ContractMethodDescription = {
  methodName: 'deposit',
  argsNames: ['amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 1) {
      console.error(`depositCall: invalid count of args`);
      return;
    }
    const [amount] = args;
    const decimals = await contract.decimals();
    await sendTransaction(
      contract,
      signer,
      'deposit',
      [],
      gasLimit,
      gasPrice,
      ethers.utils.parseUnits(amount, decimals).toString()
    );
  },
};

const withdrawCall: ContractMethodDescription = {
  methodName: 'withdraw',
  argsNames: ['amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 1) {
      console.error(`withdrawCall: invalid count of args`);
      return;
    }
    const [amount] = args;
    const decimals = await contract.decimals();
    await sendTransaction(
      contract,
      signer,
      'withdraw',
      [ethers.utils.parseUnits(amount, decimals).toString()],
      gasLimit,
      gasPrice
    );
  },
};

export const mintCall: ContractMethodDescription = {
  methodName: 'mint',
  argsNames: ['recipient', 'amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 2) {
      console.error(`mintCall: invalid count of args`);
      return;
    }
    const [recipient, amount] = args;
    const decimals = await contract.decimals();
    const signerAddress = await signer.getAddress();
    const mintAmount = ethers.utils.parseUnits(amount, decimals).toString();

    if ((await contract.masterMinter()) !== signerAddress) {
      await sendTransaction(contract, signer, 'updateMasterMinter', [signerAddress], gasLimit, gasPrice);
    }
    await sendTransaction(contract, signer, 'configureMinter', [signerAddress, mintAmount], gasLimit, gasPrice);
    await sendTransaction(contract, signer, 'mint', [recipient, mintAmount], gasLimit, gasPrice);
  },
};

export const baseTokenMethods = [approveCall, transferCall, depositCall, withdrawCall];
export const quoteTokenMethods = [approveCall, transferCall, mintCall];
