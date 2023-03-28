import { BaseContract, BigNumberish, providers, Signer } from 'ethers';
import WETH9 from '../contract-api/WETH9';
import FiatTokenV2_1 from '../contract-api/FiatTokenV2';
import UniswapV3Factory from '../contract-api/UniswapV3Factory';
import UniswapV3Pool from '../contract-api/UniswapV3Pool';
import SwapRouter from '../contract-api/SwapRouter';
import NonfungiblePositionManager from '../contract-api/NonfungiblePositionManager';

export const wethContract = (signerOrProvider?: Signer | providers.Provider) =>
  WETH9.connect(`0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`, signerOrProvider);

export const usdcContract = (signerOrProvider?: Signer | providers.Provider) =>
  FiatTokenV2_1.connect(`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, signerOrProvider);

export const uniswapFactoryContract = (signerOrProvider?: Signer | providers.Provider) =>
  UniswapV3Factory.connect(`0x1F98431c8aD98523631AE4a59f267346ea31F984`, signerOrProvider);

export const uniswapPoolContract = UniswapV3Pool.connect;

export const swapRouterContract = (signerOrProvider?: Signer | providers.Provider) =>
  SwapRouter.connect('0xE592427A0AEce92De3Edee1F18E0157C05861564', signerOrProvider);

export const nonFungiblePositionManagerContract = (signerOrProvider?: Signer | providers.Provider) =>
  NonfungiblePositionManager.connect('0xC36442b4a4522E871399CD717aBDD847Ab11FE88', signerOrProvider);

// Uniswap V3: Positions NFT 0xC36442b4a4522E871399CD717aBDD847Ab11FE88
