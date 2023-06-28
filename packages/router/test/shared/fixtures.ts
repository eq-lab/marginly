import { parseEther, parseUnits } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { MarginlyRouter } from '../../typechain-types';
import { TestERC20Token } from '../../typechain-types/contracts/test/TestERC20.sol';
import { RouterTestUniswapV3Factory } from '../../typechain-types/contracts/test/UniswapV3Test/TestUniswapV3Factory.sol';
import { RouterTestUniswapV3Pool } from '../../typechain-types/contracts/test/UniswapV3Test/TestUniswapV3Pool.sol';
import { RouterTestUniswapV2Factory } from '../../typechain-types/contracts/test/UniswapV2Test/TestUniswapV2Factory.sol';
import { RouterTestUniswapV2Pair } from '../../typechain-types/contracts/test/UniswapV2Test/TestUniswapV2Pair.sol';
import { TestVault } from '../../typechain-types/contracts/test/BalancerTest/TestVault.sol';

export interface UniswapPoolInfo {
  token0: TestERC20Token;
  token1: TestERC20Token;
  fee: number;
  address: string;
  pool: RouterTestUniswapV3Pool;
}

export async function createToken(name: string, symbol: string): Promise<TestERC20Token> {
  const [_, signer] = await ethers.getSigners();
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
  uniswapV3Factory: RouterTestUniswapV3Factory;
}> {
  const factory = await (await ethers.getContractFactory('RouterTestUniswapV3Factory')).deploy();
  const tx = await (await factory.createPool(token0.address, token1.address, 500)).wait();
  const uniswapPoolAddress = tx.events?.find((x) => x.event === 'TestPoolCreated')!.args?.pool;
  const uniswapV3Pool = await ethers.getContractAt('RouterTestUniswapV3Pool', uniswapPoolAddress);
  await token0.mint(uniswapV3Pool.address, parseUnits('100000', 18));
  await token1.mint(uniswapV3Pool.address, parseUnits('100000', 18));
  return {
    uniswapV3Pool,
    uniswapV3Factory: factory,
  };
}

export async function createUniswapV2Pair(
  token0: TestERC20Token,
  token1: TestERC20Token
): Promise<{
  uniswapV2Pair: RouterTestUniswapV2Pair;
  uniswapV2Factory: RouterTestUniswapV2Factory;
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
  return {
    uniswapV2Pair,
    uniswapV2Factory: factory,
  };
}

export async function createBalancerVault(
  token0: TestERC20Token,
  token1: TestERC20Token
): Promise<{
  balancerVault: TestVault;
}> {
  const balancerVault = await (await ethers.getContractFactory('TestVault')).deploy();
  await token0.mint(balancerVault.address, parseUnits('100000', 18));
  await token1.mint(balancerVault.address, parseUnits('100000', 18));

  return {
    balancerVault,
  };
}

export async function createMarginlyRouter(): Promise<{
  marginlyRouter: MarginlyRouter;
  token0: TestERC20Token;
  token1: TestERC20Token;
  uniswapV3Pool: RouterTestUniswapV3Pool;
  uniswapV2Pair: RouterTestUniswapV2Pair;
  balancerVault: TestVault;
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

  const { uniswapV3Pool, uniswapV3Factory } = await createUniswapV3Pool(token0, token1);
  const { uniswapV2Pair, uniswapV2Factory } = await createUniswapV2Pair(token0, token1);
  const { balancerVault } = await createBalancerVault(token0, token1);
  const factory = await ethers.getContractFactory('MarginlyRouter');
  const marginlyRouter = await factory.deploy(
    uniswapV3Factory.address,
    uniswapV2Factory.address,
    balancerVault.address
  );

  return {
    marginlyRouter,
    token0,
    token1,
    uniswapV3Pool,
    uniswapV2Pair,
    balancerVault,
  };
}
