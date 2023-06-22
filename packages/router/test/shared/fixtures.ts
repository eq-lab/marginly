import { parseEther, parseUnits } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { MarginlyRouter } from '../../typechain-types';
import { TestERC20Token } from '../../typechain-types/contracts/test/TestERC20.sol';
import { RouterTestUniswapFactory } from '../../typechain-types/contracts/test/TestUniswapFactory.sol';
import { RouterTestUniswapPool } from '../../typechain-types/contracts/test/TestUniswapPool.sol';

export interface UniswapPoolInfo {
  token0: TestERC20Token;
  token1: TestERC20Token;
  fee: number;
  address: string;
  pool: RouterTestUniswapPool;
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

export async function createUniswapPool(): Promise<{
  uniswapPool: RouterTestUniswapPool;
  token0: TestERC20Token;
  token1: TestERC20Token;
}> {
  const tokenA = await createToken('Token0', 'TK0');
  const tokenB = await createToken('Token1', 'TK1');

  let token0;
  let token1;

  if (tokenA.address < tokenB.address) {
    token0 = tokenA;
    token1 = tokenB;
  } else {
    token0 = tokenB;
    token1 = tokenA;
  }

  const pool = await ethers.getContractFactory('RouterTestUniswapPool');
  const uniswapPool = await pool.deploy(token0.address, token1.address);
  await token0.mint(uniswapPool.address, parseUnits('100000', 18));
  await token1.mint(uniswapPool.address, parseUnits('100000', 18));
  return {
    uniswapPool,
    token0,
    token1,
  };
}

export async function createUniswapFactory(): Promise<{
  uniswapFactory: RouterTestUniswapFactory;
  uniswapPoolInfo: UniswapPoolInfo;
}> {
  const factory = await ethers.getContractFactory('RouterTestUniswapFactory');
  const contract = await factory.deploy();
  const { uniswapPool: pool, token0, token1 } = await createUniswapPool();
  await contract.addPool(pool.address);

  return {
    uniswapFactory: contract,
    uniswapPoolInfo: { pool, token0: token0, token1: token1, fee: 0, address: pool.address },
  };
}

export async function createMarginlyRouter(): Promise<{ 
  marginlyRouter: MarginlyRouter, 
  quoteToken: TestERC20Token, 
  baseToken: TestERC20Token,
  uniswapPool: RouterTestUniswapPool
}> {
  const { uniswapPool, token0, token1 } = await createUniswapPool();
  const factory = await ethers.getContractFactory('MarginlyRouter');
  const marginlyRouter = await factory.deploy(uniswapPool.address);

  return {
    marginlyRouter,
    quoteToken: token0,
    baseToken: token1,
    uniswapPool,
  };
}