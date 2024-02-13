import { ethers } from 'hardhat';
import {
  SwapPoolRegistry,
  TestUniswapPool,
  TestUniswapFactory,
  TestUniswapV3Factory, PythOracle, MockPyth, ChainlinkOracle, MockChainlink,
} from '../../typechain-types';
import { UniswapV3TickOracle, UniswapV3TickOracleDouble } from '../../typechain-types/contracts/oracles';

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
  TOKEN1: '0x0000000000000000000000000000000000000001',
  TOKEN2: '0x0000000000000000000000000000000000000002',
  TOKEN3: '0x0000000000000000000000000000000000000003',
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

export const PythIds = {
  TBTC: '0x56a3121958b01f99fdc4e1fd01e81050602c7ace3a571918bb55c6a96657cca9',
  BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
};

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

export type OracleData = {
  oracle: UniswapV3TickOracle;
  pool: TestUniswapPool;
  uniswapFactory: TestUniswapFactory;
  quoteToken: string;
  baseToken: string;
};

async function createUniswapV3TickOracle(quoteToken: string, baseToken: string): Promise<OracleData> {
  const poolFactory = await ethers.getContractFactory('TestUniswapPool');
  const pool = await poolFactory.deploy(quoteToken, baseToken);
  // represents 2500 * 10 ** (-12) price value
  await pool.setTokenPriceAndTickCumulative(14073748835, 198080);

  const factory = await ethers.getContractFactory('TestUniswapFactory');
  const uniswapFactory = await factory.deploy();
  await uniswapFactory.addPool(pool.address);

  const oracleFactory = await ethers.getContractFactory('UniswapV3TickOracle');
  const oracle = await oracleFactory.deploy(uniswapFactory.address);
  await oracle.setOptions(quoteToken, baseToken, 900, 5, await pool.fee());
  return { oracle, pool, uniswapFactory, quoteToken, baseToken };
}

export async function createUniswapV3TickOracleForward(): Promise<OracleData> {
  return createUniswapV3TickOracle(Tokens.TOKEN1, Tokens.TOKEN2);
}

export async function createUniswapV3TickOracleBackward(): Promise<OracleData> {
  return createUniswapV3TickOracle(Tokens.TOKEN2, Tokens.TOKEN1);
}

export type OracleDoubleData = {
  oracle: UniswapV3TickOracleDouble;
  firstPool: TestUniswapPool;
  secondPool: TestUniswapPool;
  uniswapFactory: TestUniswapFactory;
  quoteToken: string;
  baseToken: string;
  intermediateToken: string;
};

async function createUniswapV3TickOracleDouble(
  quoteToken: string,
  baseToken: string,
  intermediateToken: string,
): Promise<OracleDoubleData> {
  const poolFactory = await ethers.getContractFactory('TestUniswapPool');
  const firstPool = await poolFactory.deploy(intermediateToken, quoteToken);
  // represents 2500 * 10 ** (-12) price value
  await firstPool.setTokenPriceAndTickCumulative(14073748835, 198080);

  const secondPool = await poolFactory.deploy(intermediateToken, baseToken);
  // represents 44100 * 10 ** (-2) = 21^2 price value
  await secondPool.setTokenPriceAndTickCumulative(5910974510923776, -60894);

  const factory = await ethers.getContractFactory('TestUniswapFactory');
  const uniswapFactory = await factory.deploy();
  await uniswapFactory.addPool(firstPool.address);
  await uniswapFactory.addPool(secondPool.address);

  const oracleFactory = await ethers.getContractFactory('UniswapV3TickOracleDouble');
  const oracle = await oracleFactory.deploy(uniswapFactory.address);
  await oracle.setOptions(
    quoteToken,
    baseToken,
    900,
    5,
    await firstPool.fee(),
    await secondPool.fee(),
    intermediateToken,
  );
  return { oracle, firstPool, secondPool, uniswapFactory, quoteToken, baseToken, intermediateToken };
}

// Naming convention below: last 3 letters represent token addresses order:
// Q -- quote, B -- base, I -- intermediate
// quoteToken < baseToken < intermediateToken
export async function createUniswapV3TickOracleDoubleQBI() {
  return createUniswapV3TickOracleDouble(Tokens.TOKEN1, Tokens.TOKEN2, Tokens.TOKEN3);
}

// quoteToken < intermediateToken < baseToken
export async function createUniswapV3TickOracleDoubleQIB() {
  return createUniswapV3TickOracleDouble(Tokens.TOKEN1, Tokens.TOKEN3, Tokens.TOKEN2);
}

//  baseToken < quoteToken < intermediateToken
export async function createUniswapV3TickOracleDoubleBQI() {
  return createUniswapV3TickOracleDouble(Tokens.TOKEN2, Tokens.TOKEN1, Tokens.TOKEN3);
}

// baseToken < intermediateToken < quoteToken
export async function createUniswapV3TickOracleDoubleBIQ() {
  return createUniswapV3TickOracleDouble(Tokens.TOKEN3, Tokens.TOKEN1, Tokens.TOKEN2);
}

// intermediateToken < quoteToken < baseToken
export async function createUniswapV3TickOracleDoubleIQB() {
  return createUniswapV3TickOracleDouble(Tokens.TOKEN2, Tokens.TOKEN3, Tokens.TOKEN1);
}

// intermediateToken < baseToken < quoteToken
export async function createUniswapV3TickOracleDoubleIBQ() {
  return createUniswapV3TickOracleDouble(Tokens.TOKEN3, Tokens.TOKEN2, Tokens.TOKEN1);
}

export type PythOracleData = {
  oracle: PythOracle;
  pyth: MockPyth;
  quoteToken: string;
  baseToken: string;
  pythId: string;
}

async function createPythOracle(quoteToken: string, baseToken: string, pythId: string): Promise<PythOracleData> {
  const factory = await ethers.getContractFactory('MockPyth');
  const mockPyth = await factory.deploy();

  const oracleFactory = await ethers.getContractFactory('PythOracle');
  const oracle = await oracleFactory.deploy(mockPyth.address);
  await oracle.setPair(quoteToken, baseToken, pythId);
  return {
    oracle,
    pyth: mockPyth,
    pythId,
    quoteToken,
    baseToken,
  };
}

export async function createSomePythOracle() {
  return createPythOracle(Tokens.USDC, Tokens.TBTC, PythIds.TBTC);
}

export type PythCompositeOracleData = {
  oracle: PythOracle;
  pyth: MockPyth;
  quoteToken: string;
  intermediateToken: string;
  baseToken: string;
  quotePythId: string;
  basePythId: string;
}

async function createPythCompositeOracle(quoteToken: string, intermediateToken: string, baseToken: string, quotePythId: string, basePythId: string): Promise<PythCompositeOracleData> {
  const factory = await ethers.getContractFactory('MockPyth');
  const mockPyth = await factory.deploy();

  const oracleFactory = await ethers.getContractFactory('PythOracle');
  const oracle = await oracleFactory.deploy(mockPyth.address);
  await oracle.setPair(intermediateToken, quoteToken, quotePythId);
  await oracle.setPair(intermediateToken, baseToken, basePythId);
  await oracle.setCompositePair(quoteToken, intermediateToken, baseToken);
  return {
    oracle,
    pyth: mockPyth,
    quoteToken,
    intermediateToken,
    baseToken,
    quotePythId,
    basePythId
  };
}

export async function createSomePythCompositeOracle() {
  return createPythCompositeOracle(Tokens.WETH, Tokens.USDC, Tokens.WBTC, PythIds.ETH, PythIds.BTC);
}

export type ChainlinkOracleData = {
  oracle: ChainlinkOracle;
  chainlink: MockChainlink;
  decimals: number;
  quoteToken: string;
  baseToken: string;
}

async function createChainlinkOracle(quoteToken: string, baseToken: string, decimals: number): Promise<ChainlinkOracleData> {
  const factory = await ethers.getContractFactory('MockChainlink');
  const mockChainlink = await factory.deploy(decimals);

  const oracleFactory = await ethers.getContractFactory('ChainlinkOracle');
  const oracle = await oracleFactory.deploy();
  await oracle.setPair(quoteToken, baseToken, mockChainlink.address);
  return {
    oracle,
    chainlink: mockChainlink,
    decimals,
    quoteToken,
    baseToken,
  };
}

export async function createSomeChainlinkOracle() {
  return createChainlinkOracle(Tokens.USDC, Tokens.TBTC, 8);
}

export type ChainlinkCompositeOracleData = {
  oracle: ChainlinkOracle;
  quoteChainlink: MockChainlink;
  baseChainlink: MockChainlink;
  quoteDecimals: number;
  baseDecimals: number;
  quoteToken: string;
  intermediateToken: string;
  baseToken: string;
}

async function createChainlinkCompositeOracle(quoteToken: string, intermediateToken: string, baseToken: string, quoteDecimals: number, baseDecimals: number): Promise<ChainlinkCompositeOracleData> {
  const factory = await ethers.getContractFactory('MockChainlink');
  const mockQuoteChainlink = await factory.deploy(quoteDecimals);
  const mockBaseChainlink = await factory.deploy(baseDecimals);

  const oracleFactory = await ethers.getContractFactory('ChainlinkOracle');
  const oracle = await oracleFactory.deploy();
  await oracle.setPair(intermediateToken, quoteToken, mockQuoteChainlink.address);
  await oracle.setPair(intermediateToken, baseToken, mockBaseChainlink.address);
  await oracle.setCompositePair(quoteToken, intermediateToken, baseToken);
  return {
    oracle,
    quoteChainlink: mockQuoteChainlink,
    baseChainlink: mockBaseChainlink,
    quoteDecimals,
    baseDecimals,
    quoteToken,
    intermediateToken,
    baseToken,
  };
}

export async function createSomeChainlinkCompositeOracle() {
  return createChainlinkCompositeOracle(Tokens.WETH, Tokens.USDC, Tokens.WBTC, 18, 8);
}