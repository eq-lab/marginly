import React from 'react';
import { ethers } from 'ethers';

export type SignerParams = {
  provider: ethers.providers.JsonRpcProvider;
  signer: ethers.Signer;
  gasLimit: number;
  gasPrice: number;
};

export type ContractsParams = {
  marginlyFactoryContract: ethers.Contract;
  marginlyPoolContract: ethers.Contract;
  uniswapPoolContract: ethers.Contract;
  swapRouterContract: ethers.Contract;
  quoteTokenContract: ethers.Contract;
  baseTokenContract: ethers.Contract;
};

export const AllSignersContext = React.createContext<ethers.Signer[]>([]);
export const SignerContext = React.createContext<SignerParams | undefined>(undefined);
export const ContractsContext = React.createContext<ContractsParams | undefined>(undefined);
