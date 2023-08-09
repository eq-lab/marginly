import { ContractMethodDescription } from './index';
import { ethers } from 'ethers';
import { sendTransaction } from './common';
import { ContractsParams } from '../../connection';

export const Dex = {
  UniswapV3: 0,
  ApeSwap: 1,
  Balancer: 2,
  Camelot: 3,
  KyberSwap: 4,
  QuickSwap: 5,
  SushiSwap: 6,
  TraderJoe: 7,
  Woofi: 8,
}

const swapExactInputCall: ContractMethodDescription = {
  methodName: 'swapExactInput',
  argsNames: ['swapCalldata', 'tokenIn', 'tokenOut', 'amountIn', 'minAmountOut'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 5) {
      console.error(`swapExactInput: invalid count of args`);
      return;
    }
    await sendTransaction(
      contract,
      signer,
      'swapExactInput',
      [args[0], args[1], args[2], args[3], args[4]],
      gasLimit,
      gasPrice
    );
  },
};

const swapExactOutputCall: ContractMethodDescription = {
  methodName: 'swapExactOutput',
  argsNames: ['swapCalldata', 'tokenIn', 'tokenOut', 'maxAmountIn', 'amountOut'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 5) {
      console.error(`swapExactOutput: invalid count of args`);
      return;
    }
    await sendTransaction(
      contract,
      signer,
      'swapExactInput',
      [args[0], args[1], args[2], args[3], args[4]],
      gasLimit,
      gasPrice
    );
  },
};

export const marginlyRouterMethods = [
  swapExactInputCall,
  swapExactOutputCall,
];
