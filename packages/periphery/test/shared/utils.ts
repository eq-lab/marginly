import { ethers } from 'hardhat';
import {
  MarginlyFactory,
  MarginlyPool,
  TestUniswapFactory,
  TestUniswapPool,
  TestERC20,
} from '@marginly/contracts/typechain-types';
import { MarginlyParamsStruct } from '@marginly/contracts/typechain-types/contracts/MarginlyFactory';
import {
  MarginlyFactoryCompiled,
  MarginlyPoolCompiled,
  TestUniswapFactoryCompiled,
  TestUniswapPoolCompiled,
  TestERC20Compiled,
  MarginlyRouterCompiled,
  MarginlyPoolAdminCompiled,
  UniswapV3AdapterCompiled,
} from './abi';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { parseEther } from 'ethers/lib/utils';
import { MarginlyAdmin, MarginlyRouter } from '../../typechain-types';
import { UniswapV3Adapter } from '@marginly/router/typechain-types';

/// @dev theme paddle front firm patient burger forward little enter pause rule limb
export const FeeHolder = '0x4c576Bf4BbF1d9AB9c359414e5D2b466bab085fa';

/// @dev tone buddy include ridge cheap because marriage sorry jungle question pretty vacuum
export const TechnicalPositionOwner = '0xDda7021A2F58a2C6E0C800692Cde7893b4462FB3';

export const UniswapV3DexIndex = 0;

export function getPoolParams() {
  const params: MarginlyParamsStruct = {
    interestRate: 54000, //5,4 %
    fee: 10000, //1%
    maxLeverage: 20,
    swapFee: 1000, // 0.1%
    mcSlippage: 50000, //5%
    priceSecondsAgo: 900, // 15 min
    priceSecondsAgoMC: 900, // 15 min
    positionMinAmount: 1, // 1 WEI
    quoteLimit: 1_000_000_000_000,
  };

  return { fee: 3000n, params };
}

export async function createToken(name: string, symbol: string): Promise<TestERC20> {
  const [, signer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory(TestERC20Compiled.abi, TestERC20Compiled.bytecode);
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
  const tokenA = await createToken('Token0', 'TKA');
  const tokenB = await createToken('Token1', 'TKB');

  const token0 = tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? tokenA : tokenB;
  const token1 = tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? tokenB : tokenA;

  const pool = await ethers.getContractFactory(TestUniswapPoolCompiled.abi, TestUniswapPoolCompiled.bytecode);
  return {
    uniswapPool: await pool.deploy(token0.address, token1.address),
    token0,
    token1,
  };
}

export async function createUniswapFactory(): Promise<{
  uniswapFactory: TestUniswapFactory;
}> {
  const factory = await ethers.getContractFactory(TestUniswapFactoryCompiled.abi, TestUniswapFactoryCompiled.bytecode);
  const contract = await factory.deploy();
  return {
    uniswapFactory: contract,
  };
}

export async function createUniswapV3Adapter(): Promise<{ uniswapV3Adapter: UniswapV3Adapter }> {
  const factory = await ethers.getContractFactory(UniswapV3AdapterCompiled.abi, UniswapV3AdapterCompiled.bytecode);
  return {
    uniswapV3Adapter: await factory.deploy([]),
  };
}

export async function createMarginlyRouter(): Promise<{
  marginlyRouter: MarginlyRouterCompiled;
  uniswapV3Adapter: UniswapV3Adapter;
}> {
  const factory = await ethers.getContractFactory(MarginlyRouterCompiled.abi, MarginlyRouterCompiled.bytecode);
  const { uniswapV3Adapter } = await createUniswapV3Adapter();
  return {
    marginlyRouter: await factory.deploy([[0, uniswapV3Adapter.address]]),
    uniswapV3Adapter,
  };
}

export async function createMarginlyPoolImplementation(): Promise<{ poolImplementation: MarginlyPool }> {
  const factory = await ethers.getContractFactory(MarginlyPoolCompiled.abi, MarginlyPoolCompiled.bytecode);
  return {
    poolImplementation: await factory.deploy(),
  };
}

export async function createMarginlyFactory(): Promise<{
  marginlyFactory: MarginlyFactory;
  uniswapFactory: TestUniswapFactory;
  owner: SignerWithAddress;
  marginlyRouter: MarginlyRouterCompiled;
  uniswapV3Adapter: UniswapV3Adapter;
  wethToken: TestERC20Compiled;
}> {
  const { uniswapFactory } = await createUniswapFactory();
  const { marginlyRouter, uniswapV3Adapter } = await createMarginlyRouter();
  const { poolImplementation } = await createMarginlyPoolImplementation();

  const wethToken = await createToken('WETH', 'WETH');

  const factoryFactory = await ethers.getContractFactory(MarginlyFactoryCompiled.abi, MarginlyFactoryCompiled.bytecode);
  const [owner] = await ethers.getSigners();
  const marginlyFactory = (await factoryFactory.deploy(
    poolImplementation.address,
    uniswapFactory.address,
    marginlyRouter.address,
    FeeHolder,
    wethToken.address,
    TechnicalPositionOwner
  )) as MarginlyFactory;
  return { marginlyFactory, uniswapFactory, owner, marginlyRouter, uniswapV3Adapter, wethToken };
}

export async function createMarginlyPoolAdmin(): Promise<{
  marginlyPoolAdmin: MarginlyAdmin;
  marginlyFactory: MarginlyFactory;
  uniswapFactory: TestUniswapFactory;
  marginlyRouter: MarginlyRouter;
}> {
  const { marginlyFactory, uniswapFactory, marginlyRouter, uniswapV3Adapter } = await createMarginlyFactory();

  const marginlyPoolAdminFactory = await ethers.getContractFactory(
    MarginlyPoolAdminCompiled.abi,
    MarginlyPoolAdminCompiled.bytecode
  );
  const marginlyPoolAdmin = (await marginlyPoolAdminFactory.deploy(marginlyFactory.address)) as MarginlyPoolAdmin;

  await marginlyFactory.transferOwnership(marginlyPoolAdmin.address);
  await marginlyPoolAdmin.acceptMarginlyFactoryOwnership();
  await marginlyRouter.transferOwnership(marginlyPoolAdmin.address);
  await marginlyPoolAdmin.acceptMarginlyRouterOwnership();
  await uniswapV3Adapter.transferOwnership(marginlyPoolAdmin.address);
  await marginlyPoolAdmin.acceptRouterAdapterOwnership(0);

  return { marginlyPoolAdmin, marginlyFactory, uniswapFactory, marginlyRouter };
}

export async function createMarginlyPoolAdminSetOwner(): Promise<{
  marginlyPoolAdmin: MarginlyAdmin;
  existingMarginlyPool: {
    address: string;
    baseToken: string;
    quoteToken: string;
    fee: bigint;
  };
  owner: SignerWithAddress;
}> {
  const { marginlyFactory, uniswapFactory, marginlyRouter, uniswapV3Adapter, owner } = await createMarginlyFactory();

  const marginlyPoolAdminFactory = await ethers.getContractFactory(
    MarginlyPoolAdminCompiled.abi,
    MarginlyPoolAdminCompiled.bytecode
  );
  const marginlyPoolAdmin = (await marginlyPoolAdminFactory.deploy(marginlyFactory.address)) as MarginlyPoolAdmin;

  const { uniswapPool, token0, token1 } = await createUniswapPool();
  await uniswapFactory.addPool(uniswapPool.address);
  const { fee, params } = getPoolParams();
  const tx = await (await marginlyFactory.createPool(token0.address, token1.address, fee, params)).wait();
  const marginlyPoolCreationEvent = tx.events?.find((x) => x.event === 'PoolCreated')!;
  const existingMarginlyPoolAddress = marginlyPoolCreationEvent.args![4];

  await marginlyFactory.transferOwnership(marginlyPoolAdmin.address);
  await marginlyPoolAdmin.acceptMarginlyFactoryOwnership();
  await marginlyRouter.transferOwnership(marginlyPoolAdmin.address);
  await marginlyPoolAdmin.acceptMarginlyRouterOwnership();
  await uniswapV3Adapter.transferOwnership(marginlyPoolAdmin.address);
  await marginlyPoolAdmin.acceptRouterAdapterOwnership(0);

  return {
    marginlyPoolAdmin,
    existingMarginlyPool: {
      address: existingMarginlyPoolAddress,
      quoteToken: token0.address,
      baseToken: token1.address,
      fee,
    },
    owner,
  };
}

export async function attachMarginlyPool(address: string): Promise<MarginlyPool> {
  const marginlyPoolFactory = await ethers.getContractFactory(MarginlyPoolCompiled.abi, MarginlyPoolCompiled.bytecode);
  return marginlyPoolFactory.attach(address);
}

export async function attachAdapterStorage(address: string): Promise<UniswapV3Adapter> {
  const uniswapV3Adapter = await ethers.getContractFactory(
    UniswapV3AdapterCompiled.abi,
    UniswapV3AdapterCompiled.bytecode
  );
  return uniswapV3Adapter.attach(address);
}
