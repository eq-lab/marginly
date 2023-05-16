import { ethers } from 'hardhat';
import {
  MarginlyFactory,
  MarginlyPool,
  TestUniswapFactory,
  TestUniswapPool,
  TestERC20,
  TestSwapRouter,
  MockAavePool,
  MockAavePoolAddressesProvider,
  MockMarginlyPool,
  MarginlyKeeper,
  MockSwapRouter,
  MockMarginlyFactory,
} from '../../typechain-types';
import { MarginlyParamsStruct } from '../../typechain-types/contracts/MarginlyFactory';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { generateWallets } from './utils';
import { Wallet } from 'ethers';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { parseEther, parseUnits } from 'ethers/lib/utils';

/// @dev theme paddle front firm patient burger forward little enter pause rule limb
export const FeeHolder = '0x4c576Bf4BbF1d9AB9c359414e5D2b466bab085fa';

export interface UniswapPoolInfo {
  token0: TestERC20;
  token1: TestERC20;
  fee: number;
  address: string;
  pool: TestUniswapPool;
}

export async function createToken(name: string, symbol: string): Promise<TestERC20> {
  const [_, signer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory('TestERC20');
  const tokenContract = await factory.deploy(name, symbol);
  await signer.sendTransaction({
    to: tokenContract.address,
    value: parseEther('100'),
  });

  return tokenContract;
}

export async function createUniswapPool(): Promise<{
  uniswapPool: TestUniswapPool;
  token0: TestERC20;
  token1: TestERC20;
}> {
  const token0 = await createToken('Token0', 'TK0');
  const token1 = await createToken('Token1', 'TK1');

  const pool = await ethers.getContractFactory('TestUniswapPool');
  return {
    uniswapPool: await pool.deploy(token0.address, token1.address),
    token0,
    token1,
  };
}

export async function createUniswapFactory(): Promise<{
  uniswapFactory: TestUniswapFactory;
  uniswapPoolInfo: UniswapPoolInfo;
}> {
  const factory = await ethers.getContractFactory('TestUniswapFactory');
  const contract = await factory.deploy();
  const { uniswapPool: pool, token0, token1 } = await createUniswapPool();
  await contract.addPool(pool.address);
  const fee = await pool.fee();

  return {
    uniswapFactory: contract,
    uniswapPoolInfo: { pool, token0: token0, token1: token1, fee, address: pool.address },
  };
}

export async function createSwapRoute(uniswapPool: string): Promise<{ swapRouter: TestSwapRouter }> {
  const factory = await ethers.getContractFactory('TestSwapRouter');
  return {
    swapRouter: await factory.deploy(uniswapPool),
  };
}

export async function createMarginlyPoolImplementation(): Promise<{ poolImplementation: MarginlyPool }> {
  const factory = await ethers.getContractFactory('MarginlyPool');
  return {
    poolImplementation: await factory.deploy(),
  };
}

export async function createMarginlyFactory(baseTokenIsWETH = true): Promise<{
  factory: MarginlyFactory;
  owner: SignerWithAddress;
  uniswapPoolInfo: UniswapPoolInfo;
  swapRouter: TestSwapRouter;
}> {
  const { uniswapFactory, uniswapPoolInfo } = await createUniswapFactory();
  const { swapRouter } = await createSwapRoute(uniswapPoolInfo.address);
  const { poolImplementation } = await createMarginlyPoolImplementation();

  await uniswapPoolInfo.token0.mint(swapRouter.address, parseUnits('100000', 18));
  await uniswapPoolInfo.token1.mint(swapRouter.address, parseUnits('100000', 18));

  const factoryFactory = await ethers.getContractFactory('MarginlyFactory');
  const [owner] = await ethers.getSigners();
  const factory = (await factoryFactory.deploy(
    poolImplementation.address,
    uniswapFactory.address,
    swapRouter.address,
    FeeHolder,
    baseTokenIsWETH ? uniswapPoolInfo.token1.address : uniswapPoolInfo.token0.address
  )) as MarginlyFactory;
  return { factory, owner, uniswapPoolInfo, swapRouter };
}

export function createMarginlyPool() {
  return createMarginlyPoolInternal(true);
}

export function createMarginlyPoolQuoteTokenIsWETH() {
  return createMarginlyPoolInternal(false);
}

async function createMarginlyPoolInternal(baseTokenIsWETH: boolean): Promise<{
  marginlyPool: MarginlyPool;
  factoryOwner: SignerWithAddress;
  uniswapPoolInfo: UniswapPoolInfo;
  quoteContract: TestERC20;
  baseContract: TestERC20;
  swapRouter: TestSwapRouter;
  marginlyFactory: MarginlyFactory;
}> {
  const { factory, owner, uniswapPoolInfo, swapRouter } = await createMarginlyFactory(baseTokenIsWETH);

  const quoteToken = uniswapPoolInfo.token0.address;
  const baseToken = uniswapPoolInfo.token1.address;
  const fee = uniswapPoolInfo.fee;

  const params: MarginlyParamsStruct = {
    interestRate: 54000, //5,4 %
    fee: 10000, //1%
    maxLeverage: 20,
    swapFee: 1000, // 0.1%
    priceSecondsAgo: 900, // 15 min
    positionSlippage: 20000, // 2%
    mcSlippage: 50000, //5%
    positionMinAmount: 5, // 5 Wei
    baseLimit: 1_000_000,
    quoteLimit: 1_000_000,
  };

  const poolAddress = await factory.callStatic.createPool(quoteToken, baseToken, fee, params);
  await factory.createPool(quoteToken, baseToken, fee, params);

  const poolFactory = await ethers.getContractFactory('MarginlyPool');
  const pool = poolFactory.attach(poolAddress) as MarginlyPool;

  // mint for the first five signers and approve spend for marginlyPool
  const amountToDeposit = 5000n * 10n ** BigInt(await uniswapPoolInfo.token0.decimals());

  const signers = (await ethers.getSigners()).slice(0, 5);
  for (let i = 0; i < signers.length; i++) {
    await uniswapPoolInfo.token0.mint(signers[i].address, amountToDeposit);
    await uniswapPoolInfo.token1.mint(signers[i].address, amountToDeposit);

    await uniswapPoolInfo.token0.connect(signers[i]).approve(poolAddress, amountToDeposit);
    await uniswapPoolInfo.token1.connect(signers[i]).approve(poolAddress, amountToDeposit);
  }

  const [quoteContract, baseContract] = [uniswapPoolInfo.token0, uniswapPoolInfo.token1];

  return {
    marginlyPool: pool,
    factoryOwner: owner,
    uniswapPoolInfo,
    quoteContract,
    baseContract,
    swapRouter,
    marginlyFactory: factory,
  };
}

/**
 * Initialize system with 10 lenders
 * 5 short positions and 5 long positions
 */
export async function getInitializedPool(): Promise<{
  marginlyPool: MarginlyPool;
  factoryOwner: SignerWithAddress;
  uniswapPoolInfo: UniswapPoolInfo;
  wallets: Wallet[];
}> {
  const { marginlyPool, factoryOwner, uniswapPoolInfo } = await createMarginlyPool();

  const amountToDeposit = 5000n * 10n ** BigInt(await uniswapPoolInfo.token0.decimals());
  const signers = await ethers.getSigners();
  for (let i = 0; i < signers.length; i++) {
    await uniswapPoolInfo.token0.mint(signers[i].address, amountToDeposit);
    await uniswapPoolInfo.token1.mint(signers[i].address, amountToDeposit);

    await uniswapPoolInfo.token0.connect(signers[i]).approve(marginlyPool.address, amountToDeposit);
    await uniswapPoolInfo.token1.connect(signers[i]).approve(marginlyPool.address, amountToDeposit);
  }

  const additionalWallets = await generateWallets(10);
  for (let i = 0; i < additionalWallets.length; i++) {
    await signers[0].sendTransaction({
      to: additionalWallets[i].address,
      value: ethers.utils.parseEther('1'), // 1 ETH
    });

    await uniswapPoolInfo.token0.mint(additionalWallets[i].address, amountToDeposit);
    await uniswapPoolInfo.token1.mint(additionalWallets[i].address, amountToDeposit);

    await uniswapPoolInfo.token0.connect(additionalWallets[i]).approve(marginlyPool.address, amountToDeposit);
    await uniswapPoolInfo.token1.connect(additionalWallets[i]).approve(marginlyPool.address, amountToDeposit);
  }

  const accounts = await ethers.getSigners();
  const lenders = accounts.slice(0, 10);
  const shorters = accounts.slice(10, 15);
  const longers = accounts.slice(15, 20);

  for (let i = 0; i < lenders.length; i++) {
    await marginlyPool.connect(lenders[i]).depositBase(1000, 0);
    await marginlyPool.connect(lenders[i]).depositQuote(5000, 0);
  }

  for (let i = 0; i < longers.length; i++) {
    await marginlyPool.connect(longers[i]).depositBase(1000 + i * 100, 0);
    await marginlyPool.connect(longers[i]).long(500 + i * 20);
  }

  for (let i = 0; i < shorters.length; i++) {
    await marginlyPool.connect(shorters[i]).depositQuote(1000 + i * 100, 0);
    await marginlyPool.connect(shorters[i]).short(500 + i * 20);
  }

  // shift time to 1 day
  await time.increase(24 * 60 * 60);

  return { marginlyPool, factoryOwner, uniswapPoolInfo, wallets: additionalWallets };
}

export async function createAavePool(): Promise<MockAavePool> {
  const factory = await ethers.getContractFactory('MockAavePool');
  return factory.deploy();
}

export async function createAavePoolAddressProvider(poolAddress: string): Promise<MockAavePoolAddressesProvider> {
  const factory = await ethers.getContractFactory('MockAavePoolAddressesProvider');
  return factory.deploy(poolAddress);
}

export async function createMockMarginlyFactory(swapRouterAddress: string): Promise<MockMarginlyFactory> {
  const factory = await ethers.getContractFactory('MockMarginlyFactory');
  return factory.deploy(swapRouterAddress);
}

export async function createMockMarginlyPool(
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
  baseToken: TestERC20;
  quoteToken: TestERC20;
  marginlyPool: MockMarginlyPool;
}> {
  const aavePool = await createAavePool();
  const addressesProvider = await createAavePoolAddressProvider(aavePool.address);
  const baseToken = await createToken('Base token', 'BT');
  const quoteToken = await createToken('Quote token', 'QT');
  const swapRouter = await createSwapRouter(quoteToken.address, baseToken.address);
  const marginlyFactory = await createMockMarginlyFactory(swapRouter.address);
  const marginlyPool = await createMockMarginlyPool(marginlyFactory.address, quoteToken.address, baseToken.address);

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
