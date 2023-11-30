import { ethers } from 'hardhat';
import {
  ChainlinkAggregatorV3Mock,
  MockMarginlyPoolWithPriceAdapter,
  PriceAdapter,
  SwapPoolRegistry,
  TestUniswapV3Factory,
} from '../../typechain-types';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

//Some random addresses for testing purposes
export const Tokens = {
  USDC: '0x223A8AD119A1FAd4822869B7Cf79a74645470ad0',
  WBTC: '0xaA30A674e44F9Ba57D13eBA12ea499d55D24Cb9C',
  RDNT: '0x5D5Fa579300D123a7c01ECe355F82f5c0a379e80',
  MATIC: '0x2c88cC92Feeb3c5DE63f9A452B87aaC2E2510776',
  WETH: '0xeBEc6FA34180Ca3537bdeB4338b1B533a85920af',
  PENDLE: '0x79696e0859A0Af409617e39d817864AFF7565dBd',
  TBTC: '0xAB249FdD9F3e5D90d65007EAf5A6c4Ca05E1E72f',
  GMX: '0xBc030A9e840202971f881A70143B63AC77dbc199',
};

export type Pool = {
  pool: string;
  tokenA: string;
  tokenB: string;
  fee: number;
};

export const initialPools: Pool[] = [
  {
    pool: '0xF338C5351b4Ff13749Dd6d02d22C105626aEd353',
    tokenA: Tokens.USDC,
    tokenB: Tokens.WETH,
    fee: 300,
  },
  {
    pool: '0x9F4780E33C91cB7fFc00C25a021C2c57A1e663D9',
    tokenA: Tokens.USDC,
    tokenB: Tokens.WETH,
    fee: 500,
  },
  {
    pool: '0xFb7056FcdcB97ac76987f6eBCeB54461d4dE5310',
    tokenA: Tokens.USDC,
    tokenB: Tokens.WETH,
    fee: 1000,
  },
  {
    pool: '0x457a4bE785aB1Af8e68132c267329A30c56f6B5C',
    tokenA: Tokens.WETH,
    tokenB: Tokens.WBTC,
    fee: 300,
  },
  {
    pool: '0xb9Cd78A7126326F1af5ddA3b7264E35d1a6F1fF4',
    tokenA: Tokens.USDC,
    tokenB: Tokens.MATIC,
    fee: 300,
  },
  {
    pool: '0x37244f8eD493c1A2FB2004CD104fEEEd2E7d31A8',
    tokenA: Tokens.USDC,
    tokenB: Tokens.RDNT,
    fee: 300,
  },
  {
    pool: '0xc519a974aaCF8dA54d136860fe52f353a5232D15',
    tokenA: Tokens.USDC,
    tokenB: Tokens.WBTC,
    fee: 300,
  },
];

export async function createUniswapV3Factory(): Promise<TestUniswapV3Factory> {
  const contractFactory = await ethers.getContractFactory('TestUniswapV3Factory');
  const testUniswapV3Factory = await contractFactory.deploy(initialPools);
  return testUniswapV3Factory;
}

export async function createSwapPoolRegistry(): Promise<{
  canonicalFactory: TestUniswapV3Factory;
  swapPoolRegistry: SwapPoolRegistry;
}> {
  const canonicalFactory = await createUniswapV3Factory();
  const contractFactory = await ethers.getContractFactory('SwapPoolRegistry');
  const swapPoolRegistry = await contractFactory.deploy(canonicalFactory.address, []);

  return {
    canonicalFactory,
    swapPoolRegistry,
  };
}

export async function createChainlinkAggregator(price: bigint, decimals: bigint): Promise<ChainlinkAggregatorV3Mock> {
  const factory = await ethers.getContractFactory('ChainlinkAggregatorV3Mock');
  return factory.deploy(price, decimals);
}

export async function createPriceAdapter(
  chainlinkAggregatorBase: string,
  chainlinkAggregatorQuote: string
): Promise<PriceAdapter> {
  const factory = await ethers.getContractFactory('PriceAdapter');
  return factory.deploy(chainlinkAggregatorBase, chainlinkAggregatorQuote);
}

export function createMarginlyPoolWithPriceAdapter(
  basePrice: { price: bigint; decimals: bigint },
  quotePrice: { price: bigint; decimals: bigint } | null
) {
  async function inner(): Promise<{
    chainlinkAggregatorBase: ChainlinkAggregatorV3Mock;
    chainlinkAggregatorQuote: ChainlinkAggregatorV3Mock | null;
    priceAdapter: PriceAdapter;
    marginlyPoolWithPriceAdapter: MockMarginlyPoolWithPriceAdapter;
  }> {
    const chainlinkAggregatorBase = await createChainlinkAggregator(basePrice.price, basePrice.decimals); // btc
    const chainlinkAggregatorQuote =
      quotePrice && (await createChainlinkAggregator(quotePrice.price, quotePrice.decimals)); // eth
    const priceAdapter = await createPriceAdapter(
      chainlinkAggregatorBase.address,
      chainlinkAggregatorQuote !== null ? chainlinkAggregatorQuote.address : ethers.constants.AddressZero
    );
    const factory = await ethers.getContractFactory('MockMarginlyPoolWithPriceAdapter');
    const marginlyPoolWithPriceAdapter = await factory.deploy(priceAdapter.address);
    return { chainlinkAggregatorBase, chainlinkAggregatorQuote, priceAdapter, marginlyPoolWithPriceAdapter };
  }

  return inner;
}
