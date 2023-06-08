import { ethers } from './mocks';
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
} from './mocks';
import { MarginlyParamsStruct } from '../../typechain-types/contracts/MarginlyFactory';
import { SignerWithAddress } from './mocks';
import { generateWallets, CallType, ZERO_ADDRESS } from './utils';
import { Wallet } from 'zksync-web3';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { Contract } from 'ethers';

/// @dev theme paddle front firm patient burger forward little enter pause rule limb
export const FeeHolder = '0x4c576Bf4BbF1d9AB9c359414e5D2b466bab085fa';

/// @dev tone buddy include ridge cheap because marriage sorry jungle question pretty vacuum
export const TechnicalPositionOwner = '0xDda7021A2F58a2C6E0C800692Cde7893b4462FB3';

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
  const tx = await signer.sendTransaction({
    to: tokenContract.address,
    value: parseEther('100'),
  });
  await tx.wait();

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
  await (await contract.addPool(pool.address)).wait();
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

export async function createMarginlyFactory(baseTokenIsWETH = true, isTimeMove: boolean = false): Promise<{
  factory: MarginlyFactory;
  owner: SignerWithAddress;
  uniswapPoolInfo: UniswapPoolInfo;
  swapRouter: TestSwapRouter;
}> {
  const { uniswapFactory, uniswapPoolInfo } = await createUniswapFactory();
  const { swapRouter } = await createSwapRoute(uniswapPoolInfo.address);
  const poolImplementationAddress = '0x0000000000000000000000000000000000000000';

  await (await uniswapPoolInfo.token0.mint(swapRouter.address, parseUnits('100000', 18))).wait();
  await (await uniswapPoolInfo.token1.mint(swapRouter.address, parseUnits('100000', 18))).wait();

  const contractName = isTimeMove ? 'TimeMoveMarginlyFactory' : 'MarginlyFactory';

  const factoryFactory = await ethers.getContractFactory(contractName);
  const [owner] = await ethers.getSigners();
  const factory = (await factoryFactory.deploy(
    poolImplementationAddress,
    uniswapFactory.address,
    swapRouter.address,
    FeeHolder,
    baseTokenIsWETH ? uniswapPoolInfo.token1.address : uniswapPoolInfo.token0.address,
    TechnicalPositionOwner
  )) as MarginlyFactory;
  return { factory, owner, uniswapPoolInfo, swapRouter };
}

export function createMarginlyPool() {
  return createMarginlyPoolInternal(true);
}

export function createMarginlyPoolQuoteTokenIsWETH() {
  return createMarginlyPoolInternal(false);
}

export function createTimeMoveMarginlyPool(){
  return createMarginlyPoolInternal(true, true);
}

export const initialPoolTimestamp = (new Date('2023-05-24T00:00:00.000Z')).getTime() / 1000;

async function createMarginlyPoolInternal(baseTokenIsWETH: boolean, isTimeMove: boolean = false): Promise<{
  marginlyPool: MarginlyPool;
  factoryOwner: SignerWithAddress;
  uniswapPoolInfo: UniswapPoolInfo;
  quoteContract: TestERC20;
  baseContract: TestERC20;
  swapRouter: TestSwapRouter;
  marginlyFactory: MarginlyFactory;
}> {
  const { factory, owner, uniswapPoolInfo, swapRouter } = await createMarginlyFactory(baseTokenIsWETH, isTimeMove);

  const quoteToken = uniswapPoolInfo.token0.address;
  const baseToken = uniswapPoolInfo.token1.address;
  const fee = uniswapPoolInfo.fee;

  const params: MarginlyParamsStruct = {
    interestRate: 54000, //5,4 %
    fee: 20000, //2%
    maxLeverage: 20,
    swapFee: 1000, // 0.1%
    priceSecondsAgo: 900, // 15 min
    positionSlippage: 20000, // 2%
    mcSlippage: 50000, //5%
    positionMinAmount: 5, // 5 Wei
    baseLimit: 1_000_000,
    quoteLimit: 1_000_000,
  };

  let poolAddress: string;
  let poolContractName: string;
  if (isTimeMove) {
    poolAddress = await factory.callStatic.createPool(quoteToken, baseToken, fee, params, initialPoolTimestamp);
    await (await factory.createPool(quoteToken, baseToken, fee, params, initialPoolTimestamp)).wait();
    poolContractName = 'TimeMoveMarginlyPool';
  } else {
    poolAddress = await factory.callStatic.createPool(quoteToken, baseToken, fee, params);
    await (await factory.createPool(quoteToken, baseToken, fee, params)).wait();
    poolContractName = 'MarginlyPool';
  }
  //     const tx = await marginlyPool.connect(signer).depositBase(depositAmount, 0);
  //     const depositBaseEvent = (await tx.wait()).events?.find((x) => x.event === 'DepositBase')!;

  // const txInfo = await (await factory.createPool(quoteToken, baseToken, fee, params)).wait();
  // const event = txInfo.events.find(x => x.event === 'PoolCreated');
  // const poolAddress = event.args.pool;
  //
  // const poolFactory = await ethers.getContractFactory('MarginlyPool');
  // const pool = poolFactory.attach(poolAddress) as MarginlyPool;

  // const foo = await pool.lastReinitTimestampSeconds();
  // const params1 = await pool.params();
  const poolFactory = await ethers.getContractFactory(poolContractName);
  const pool = poolFactory.attach(poolAddress) as MarginlyPool;

  // mint for the first five signers and approve spend for marginlyPool
  const amountToDeposit = 5000n * 10n ** BigInt(await uniswapPoolInfo.token0.decimals());

  const signers = (await ethers.getSigners()).slice(0, 5);
  for (let i = 0; i < signers.length; i++) {
    await (await uniswapPoolInfo.token0.mint(signers[i].address, amountToDeposit)).wait();
    await (await uniswapPoolInfo.token1.mint(signers[i].address, amountToDeposit)).wait();

    await (await uniswapPoolInfo.token0.connect(signers[i]).approve(poolAddress, amountToDeposit)).wait();
    await (await uniswapPoolInfo.token1.connect(signers[i]).approve(poolAddress, amountToDeposit)).wait();
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

export async function increatePoolTimestamp(pool: Contract, timeShift: number): Promise<void> {
  const currentTimestamp = await pool.blockTimestamp();
  const nextTimeStamp = BigInt(currentTimestamp) + BigInt(timeShift);
  await (await pool.setTimestamp(nextTimeStamp)).wait();
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
    await marginlyPool.connect(lenders[i]).execute(CallType.DepositBase, 1000, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(lenders[i]).execute(CallType.DepositQuote, 5000, 0, false, ZERO_ADDRESS);
  }

  for (let i = 0; i < longers.length; i++) {
    await marginlyPool.connect(longers[i]).execute(CallType.DepositBase, 1000 + i * 100, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(longers[i]).execute(CallType.Long, 500 + i * 20, 0, false, ZERO_ADDRESS);
  }

  for (let i = 0; i < shorters.length; i++) {
    await marginlyPool.connect(shorters[i]).execute(CallType.DepositQuote, 1000 + i * 100, 0, false, ZERO_ADDRESS);
    await marginlyPool.connect(shorters[i]).execute(CallType.Short, 500 + i * 20, 0, false, ZERO_ADDRESS);
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

  await (await baseToken.mint(marginlyPool.address, mintAmount)).wait();
  await (await quoteToken.mint(marginlyPool.address, mintAmount)).wait();

  await (await baseToken.mint(swapRouter.address, mintAmount)).wait();
  await (await quoteToken.mint(swapRouter.address, mintAmount)).wait();

  await (await baseToken.mint(aavePool.address, mintAmount)).wait();
  await (await quoteToken.mint(aavePool.address, mintAmount)).wait();

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
