import { parseEther, parseUnits } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { CurveAdapter, IMarginlyAdapter, MarginlyRouter, TestStableSwap2EMAOraclePool } from '../../typechain-types';
import { TestERC20Token } from '../../typechain-types';
import { RouterTestUniswapV3Pool } from '../../typechain-types';
import { RouterTestUniswapV2Pair } from '../../typechain-types';
import { TestVault } from '../../typechain-types';
import { TestWooPPV2 } from '../../typechain-types';
import { TestDodoV1Pool } from '../../typechain-types';
import { TestDodoV2Pool } from '../../typechain-types';
import { TestBalancerPool } from '../../typechain-types';
import { TestSwapInfo } from '../../typechain-types';
import { Dex } from './utils';
import { BigNumber } from 'ethers';

export interface UniswapPoolInfo {
  token0: TestERC20Token;
  token1: TestERC20Token;
  fee: number;
  address: string;
  pool: RouterTestUniswapV3Pool;
}

export async function createToken(name: string, symbol: string): Promise<TestERC20Token> {
  const [, signer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory('TestERC20Token');
  const tokenContract = await factory.deploy(name, symbol);
  await signer.sendTransaction({
    to: tokenContract.address,
    value: parseEther('100'),
  });

  return tokenContract;
}

export async function createUniswapV3Pool(
  token0: TestERC20Token,
  token1: TestERC20Token
): Promise<{
  uniswapV3Pool: RouterTestUniswapV3Pool;
  uniswapV3Adapter: IMarginlyAdapter;
}> {
  const factory = await (await ethers.getContractFactory('RouterTestUniswapV3Factory')).deploy();
  const tx = await (await factory.createPool(token0.address, token1.address, 500)).wait();
  const uniswapPoolAddress = tx.events?.find((x) => x.event === 'TestPoolCreated')!.args?.pool;
  const uniswapV3Pool = await ethers.getContractAt('RouterTestUniswapV3Pool', uniswapPoolAddress);
  await token0.mint(uniswapV3Pool.address, parseUnits('100000', 18));
  await token1.mint(uniswapV3Pool.address, parseUnits('100000', 18));

  const adapterInput = [{ token0: token0.address, token1: token1.address, pool: uniswapV3Pool.address }];
  const uniswapV3Adapter = await (await ethers.getContractFactory('UniswapV3Adapter')).deploy(adapterInput);
  return {
    uniswapV3Pool,
    uniswapV3Adapter,
  };
}

export async function createUniswapV2Pair(
  token0: TestERC20Token,
  token1: TestERC20Token
): Promise<{
  uniswapV2Pair: RouterTestUniswapV2Pair;
  uniswapV2Adapter: IMarginlyAdapter;
}> {
  const factory = await (await ethers.getContractFactory('RouterTestUniswapV2Factory')).deploy();
  const tx = await (await factory.createPair(token0.address, token1.address)).wait();
  const uniswapPoolAddress = tx.events?.find((x) => x.event === 'TestPairCreated')!.args?.pair;
  const uniswapV2Pair = await ethers.getContractAt('RouterTestUniswapV2Pair', uniswapPoolAddress);
  // random number between 10k and 1kk
  const token0Supply = Math.floor(Math.random() * (1000000 - 10000)) + 10000;
  const token1Supply = Math.floor(Math.random() * (1000000 - 10000)) + 10000;
  await token0.mint(uniswapV2Pair.address, parseUnits(token0Supply.toString(), 18));
  await token1.mint(uniswapV2Pair.address, parseUnits(token1Supply.toString(), 18));
  await uniswapV2Pair.sync();

  const adapterInput = [{ token0: token0.address, token1: token1.address, pool: uniswapV2Pair.address }];
  const uniswapV2Adapter = await (await ethers.getContractFactory('UniswapV2Adapter')).deploy(adapterInput);
  return {
    uniswapV2Pair,
    uniswapV2Adapter,
  };
}

export async function createBalancer(
  token0: TestERC20Token,
  token1: TestERC20Token
): Promise<{
  balancerVault: TestVault;
  balancerPool: TestBalancerPool;
  balancerAdapter: IMarginlyAdapter;
}> {
  const balancerPool = await (await ethers.getContractFactory('TestBalancerPool')).deploy();
  const balancerVault = await (await ethers.getContractFactory('TestVault')).deploy();
  await token0.mint(balancerVault.address, parseUnits('100000', 18));
  await token1.mint(balancerVault.address, parseUnits('100000', 18));

  const adapterInput = [{ token0: token0.address, token1: token1.address, pool: balancerPool.address }];
  const balancerAdapter = await (
    await ethers.getContractFactory('BalancerAdapter')
  ).deploy(adapterInput, balancerVault.address);
  return {
    balancerVault,
    balancerPool,
    balancerAdapter,
  };
}

export async function createWooPool(
  token0: TestERC20Token,
  token1: TestERC20Token
): Promise<{
  wooPool: TestWooPPV2;
  wooFiAdapter: IMarginlyAdapter;
}> {
  const quoteToken = await createToken('WooQuoteToken', 'WQT');
  const wooPool = await (await ethers.getContractFactory('TestWooPPV2')).deploy(quoteToken.address);
  await token0.mint(wooPool.address, parseUnits('100000', 18));
  await token1.mint(wooPool.address, parseUnits('100000', 18));
  await wooPool.sync(token0.address);
  await wooPool.sync(token1.address);

  const adapterInput = [{ token0: token0.address, token1: token1.address, pool: wooPool.address }];
  const wooFiAdapter = await (await ethers.getContractFactory('WooFiAdapter')).deploy(adapterInput);
  return {
    wooPool,
    wooFiAdapter,
  };
}

export async function createDodoV1Pool(
  token0: TestERC20Token,
  token1: TestERC20Token
): Promise<{
  dodoV1Pool: TestDodoV1Pool;
  dodoV1Adapter: IMarginlyAdapter;
}> {
  const dodoV1Pool = await (await ethers.getContractFactory('TestDodoV1Pool')).deploy(token0.address, token1.address);
  await token0.mint(dodoV1Pool.address, parseUnits('100000', 18));
  await token1.mint(dodoV1Pool.address, parseUnits('100000', 18));
  await dodoV1Pool.sync();

  const adapterInput = [{ token0: token0.address, token1: token1.address, pool: dodoV1Pool.address }];
  const dodoV1Adapter = await (await ethers.getContractFactory('DodoV1Adapter')).deploy(adapterInput);
  return {
    dodoV1Pool,
    dodoV1Adapter,
  };
}

export async function createDodoV2Pool(
  token0: TestERC20Token,
  token1: TestERC20Token
): Promise<{
  dodoV2Pool: TestDodoV2Pool;
  dodoV2Adapter: IMarginlyAdapter;
}> {
  const dodoV2Pool = await (await ethers.getContractFactory('TestDodoV2Pool')).deploy(token0.address, token1.address);
  await token0.mint(dodoV2Pool.address, parseUnits('100000', 18));
  await token1.mint(dodoV2Pool.address, parseUnits('100000', 18));
  await dodoV2Pool.sync();

  const adapterInput = [{ token0: token0.address, token1: token1.address, pool: dodoV2Pool.address }];
  const dodoV2Adapter = await (await ethers.getContractFactory('DodoV2Adapter')).deploy(adapterInput);
  return {
    dodoV2Pool,
    dodoV2Adapter,
  };
}

export async function createMarginlyRouter(): Promise<{
  marginlyRouter: MarginlyRouter;
  token0: TestERC20Token;
  token1: TestERC20Token;
  uniswapV3: { pool: RouterTestUniswapV3Pool; adapter: IMarginlyAdapter };
  uniswapV2: { pool: RouterTestUniswapV2Pair; adapter: IMarginlyAdapter };
  balancer: { vault: TestVault; adapter: IMarginlyAdapter };
  wooFi: { pool: TestWooPPV2; adapter: IMarginlyAdapter };
  dodoV1: { pool: TestDodoV1Pool; adapter: IMarginlyAdapter };
  dodoV2: { pool: TestDodoV2Pool; adapter: IMarginlyAdapter };
}> {
  const tokenA = await createToken('TokenA', 'TKA');
  const tokenB = await createToken('TokenB', 'TKB');
  let token0;
  let token1;

  if (tokenA.address.toLowerCase() < tokenB.address.toLowerCase()) {
    token0 = tokenA;
    token1 = tokenB;
  } else {
    token0 = tokenB;
    token1 = tokenA;
  }

  const { uniswapV3Pool, uniswapV3Adapter } = await createUniswapV3Pool(token0, token1);
  const { uniswapV2Pair, uniswapV2Adapter } = await createUniswapV2Pair(token0, token1);
  const { balancerVault, balancerAdapter } = await createBalancer(token0, token1);
  const { wooPool, wooFiAdapter } = await createWooPool(token0, token1);
  const { dodoV1Pool, dodoV1Adapter } = await createDodoV1Pool(token0, token1);
  const { dodoV2Pool, dodoV2Adapter } = await createDodoV2Pool(token0, token1);
  const factory = await ethers.getContractFactory('MarginlyRouter');

  let constructorInput = [];

  constructorInput.push({
    dexIndex: Dex.UniswapV3,
    adapter: uniswapV3Adapter.address,
  });
  constructorInput.push({
    dexIndex: Dex.QuickSwap,
    adapter: uniswapV2Adapter.address,
  });
  constructorInput.push({
    dexIndex: Dex.Balancer,
    adapter: balancerAdapter.address,
  });
  constructorInput.push({ dexIndex: Dex.Woofi, adapter: wooFiAdapter.address });
  constructorInput.push({ dexIndex: Dex.DodoV1, adapter: dodoV1Adapter.address });
  constructorInput.push({ dexIndex: Dex.DodoV2, adapter: dodoV2Adapter.address });

  const marginlyRouter = await factory.deploy(constructorInput);

  return {
    marginlyRouter,
    token0,
    token1,
    uniswapV3: { pool: uniswapV3Pool, adapter: uniswapV3Adapter },
    uniswapV2: { pool: uniswapV2Pair, adapter: uniswapV2Adapter },
    balancer: { vault: balancerVault, adapter: balancerAdapter },
    wooFi: { pool: wooPool, adapter: wooFiAdapter },
    dodoV1: { pool: dodoV1Pool, adapter: dodoV1Adapter },
    dodoV2: { pool: dodoV2Pool, adapter: dodoV2Adapter },
  };
}

export async function createTestSwapInfo(): Promise<TestSwapInfo> {
  return await (await ethers.getContractFactory('TestSwapInfo')).deploy();
}

async function createCurveAdapterInner(inverse: boolean): Promise<{
  router: MarginlyRouter;
  adapter: CurveAdapter;
  pool: TestStableSwap2EMAOraclePool;
  token0: TestERC20Token;
  token1: TestERC20Token;
}> {
  const token0 = await createToken('Token0', 'TK0');
  const token1 = await createToken('Token1', 'TK1');
  const pool = await (
    await ethers.getContractFactory('TestStableSwap2EMAOraclePool')
  ).deploy(token0.address, token1.address);

  await token0.mint(pool.address, BigNumber.from(10).pow(20));
  await token1.mint(pool.address, BigNumber.from(10).pow(20));

  const adapterInput = [
    {
      token0: inverse ? token1.address : token0.address,
      token1: inverse ? token0.address : token1.address,
      pool: pool.address,
    },
  ];
  const adapter = await (await ethers.getContractFactory('CurveAdapter')).deploy(adapterInput);

  const router = await (
    await ethers.getContractFactory('MarginlyRouter')
  ).deploy([
    {
      dexIndex: Dex.Curve,
      adapter: adapter.address,
    },
  ]);

  return { router, adapter, pool, token0, token1 };
}

export async function createCurveAdapter(): Promise<{
  router: MarginlyRouter;
  adapter: CurveAdapter;
  pool: TestStableSwap2EMAOraclePool;
  token0: TestERC20Token;
  token1: TestERC20Token;
}> {
  return await createCurveAdapterInner(false);
}

export async function createCurveAdapterInverse(): Promise<{
  router: MarginlyRouter;
  adapter: CurveAdapter;
  pool: TestStableSwap2EMAOraclePool;
  token0: TestERC20Token;
  token1: TestERC20Token;
}> {
  return await createCurveAdapterInner(true);
}
