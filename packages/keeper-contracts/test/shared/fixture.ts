import { ethers } from 'hardhat';

import {
  MockAavePool,
  MockERC20Token,
  MockAavePoolAddressesProvider,
  MockMarginlyPool,
  MarginlyKeeper,
  MockSwapRouter,
  MockMarginlyFactory,
} from '../../typechain-types';

export async function createToken(name: string, symbol: string): Promise<MockERC20Token> {
  const factory = await ethers.getContractFactory('MockERC20Token');
  return factory.deploy(name, symbol);
}

export async function createAavePool(): Promise<MockAavePool> {
  const factory = await ethers.getContractFactory('MockAavePool');
  return factory.deploy();
}

export async function createAavePoolAddressProvider(poolAddress: string): Promise<MockAavePoolAddressesProvider> {
  const factory = await ethers.getContractFactory('MockAavePoolAddressesProvider');
  return factory.deploy(poolAddress);
}

export async function createMarginlyFactory(swapRouterAddress: string): Promise<MockMarginlyFactory> {
  const factory = await ethers.getContractFactory('MockMarginlyFactory');
  return factory.deploy(swapRouterAddress);
}

export async function createMarginlyPool(
  marginlyFactory: string,
  quoteToken: string,
  baseToken: string
): Promise<MockMarginlyPool> {
  const factory = await ethers.getContractFactory('MockMarginlyPool');
  return factory.deploy(marginlyFactory, quoteToken, baseToken);
}

export async function createSwapRouter(quoteToken: string, baseToken: string): Promise<MockSwapRouter> {
  const factory = await ethers.getContractFactory('MockSwapRouter');
  return factory.deploy(quoteToken, baseToken);
}

export async function createMarginlyKeeperContract(): Promise<{
  marginlyKeeper: MarginlyKeeper;
  swapRouter: MockSwapRouter;
  baseToken: MockERC20Token;
  quoteToken: MockERC20Token;
  marginlyPool: MockMarginlyPool;
}> {
  const aavePool = await createAavePool();
  const addressesProvider = await createAavePoolAddressProvider(aavePool.address);
  const baseToken = await createToken('Base token', 'BT');
  const quoteToken = await createToken('Quote token', 'QT');
  const swapRouter = await createSwapRouter(quoteToken.address, baseToken.address);
  const marginlyFactory = await createMarginlyFactory(swapRouter.address);
  const marginlyPool = await createMarginlyPool(marginlyFactory.address, quoteToken.address, baseToken.address);

  const decimals = BigInt(await baseToken.decimals());
  const mintAmount = 10000000000n * 10n ** decimals;

  await baseToken.mint(marginlyPool.address, mintAmount);
  await quoteToken.mint(marginlyPool.address, mintAmount);

  await baseToken.mint(swapRouter.address, mintAmount);
  await quoteToken.mint(swapRouter.address, mintAmount);

  await baseToken.mint(aavePool.address, mintAmount);
  await quoteToken.mint(aavePool.address, mintAmount);

  const factory = await ethers.getContractFactory('MarginlyKeeper');
  const marginlyKeeper = await factory.deploy(addressesProvider.address);

  return {
    marginlyKeeper,
    swapRouter,
    baseToken,
    quoteToken,
    marginlyPool,
  };
}
