import { Wallet, Contract } from 'zksync-web3';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { priceToPriceFp18, priceToSqrtPriceX96, sortUniswapPoolTokens } from '@marginly/common/math';
import { SwapRouterMock } from '../typechain-types';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });
}

export const richWalletPks = [
  '0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110',
  '0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3',
  '0xd293c684d884d56f8d6abd64fc76757d3664904e309a0645baf8522ab6366d9e'
];

export async function createToken(deployer: Deployer, name: string, symbol: string, decimals: number = 18): Promise<Contract> {
  const artifact = await deployer.loadArtifact('MintableToken');
  return await deployer.deploy(artifact, [name, symbol, decimals]);
}

export async function createWeth9(deployer: Deployer): Promise<Contract> {
  const artifact = await deployer.loadArtifact('WETH9');
  return await deployer.deploy(artifact, []);
}

export async function createUniswapV3PoolMock(deployer: Deployer, oracle: string, tokenA: string, tokenB: string, fee: number): Promise<Contract> {
  const artifact = await deployer.loadArtifact('UniswapV3PoolMock');
  return await deployer.deploy(artifact, [oracle, tokenA, tokenB, fee]);
}

export async function createTestUniswapV3PoolMock(deployer: Deployer, oracle: string, tokenA: string, tokenB: string, fee: number): Promise<Contract> {
  const artifact = await deployer.loadArtifact('TestUniswapV3PoolMock');
  return await deployer.deploy(artifact, [oracle, tokenA, tokenB, fee]);
}

export async function createSwapRouterMock(deployer: Deployer, weth: string): Promise<Contract> {
  const artifact = await deployer.loadArtifact('SwapRouterMock');
  return await deployer.deploy(artifact, [weth]);
}
export async function setPrice(pool: Contract, oracle: Wallet, tokens: [Contract, Contract], price: number) {
  const [tokenA, tokenB] = tokens;
  const [token0, token1] = sortUniswapPoolTokens(
    [tokenA.address as `0x${string}`, tokenB.address as `0x${string}`],
    [
      {
        symbol: await tokenA.symbol(),
        address: tokenA.address,
        decimals: await tokenA.decimals(),
        price: price,
      },
      {
        symbol: await tokenB.symbol(),
        address: tokenB.address,
        decimals: await tokenB.decimals(),
        price: 1 / price,
      },
    ],
  );

  const priceFp18 = priceToPriceFp18(token0.price, token0.decimals, token1.decimals);
  const sqrtPriceX96 = priceToSqrtPriceX96(token0.price, token0.decimals, token1.decimals);

  await (await pool.connect(oracle).setPrice(priceFp18, sqrtPriceX96)).wait();
}
