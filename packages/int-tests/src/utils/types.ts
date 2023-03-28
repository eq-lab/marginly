import { Wallet } from 'ethers';
import { FiatTokenV2_1Contract } from '../contract-api/FiatTokenV2';
import { MarginlyPoolContract } from '../contract-api/MarginlyPool';
import { NonfungiblePositionManagerContract } from '../contract-api/NonfungiblePositionManager';
import { SwapRouterContract } from '../contract-api/SwapRouter';
import { UniswapV3PoolContract } from '../contract-api/UniswapV3Pool';
import { WETH9Contract } from '../contract-api/WETH9';

export type ContractsCollection = {
  weth: WETH9Contract;
  usdc: FiatTokenV2_1Contract;
  uniswap: UniswapV3PoolContract;
  marginly: MarginlyPoolContract;
  nonFungiblePositionManager: NonfungiblePositionManagerContract;
  swapRouter: SwapRouterContract;
};
export type Suite = (contracts: ContractsCollection, treasury: Wallet, accounts: Wallet[]) => Promise<void>;
