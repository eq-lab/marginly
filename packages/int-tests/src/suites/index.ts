import { Wallet } from 'ethers';
import { logger } from '../utils/logger';
import { Web3Provider } from '@ethersproject/providers';
import { initUsdc, initWeth } from '../utils/erc20-init';
import {
  uniswapFactoryContract,
  uniswapPoolContract,
  swapRouterContract,
  nonFungiblePositionManagerContract,
} from '../utils/known-contracts';
import { Dex, Web3ProviderDecorator } from '../utils/chain-ops';
import MarginlyFactory, { MarginlyFactoryContract } from '../contract-api/MarginlyFactory';
import MarginlyPool, { MarginlyPoolContract } from '../contract-api/MarginlyPool';
import { UniswapV3PoolContract } from '../contract-api/UniswapV3Pool';
import { UniswapV3FactoryContract } from '../contract-api/UniswapV3Factory';
import { SwapRouterContract } from '../contract-api/SwapRouter';
import { FiatTokenV2_1Contract } from '../contract-api/FiatTokenV2';
import { WETH9Contract } from '../contract-api/WETH9';
import { long } from './long';
import { short } from './short';
import { longAndShort } from './long_and_short';
import { longIncome } from './long_income';
import { shortIncome } from './short_income';
import { mc } from './mc';
import { GasReporter } from '../utils/GasReporter';
import { simulation1, simulation2, simulation3 } from './simulation';
import { longEmergency, shortEmergency } from './shutdown';
import MarginlyKeeper, { MarginlyKeeperContract } from '../contract-api/MarginlyKeeper';
import { keeper } from './keeper';
import MarginlyRouter, { MarginlyRouterContract } from '../contract-api/MarginlyRouter';
import { ZERO_ADDRESS } from '../utils/const';
import {
  deleveragePrecisionLong,
  deleveragePrecisionShort,
  deleveragePrecisionLongCollateral,
  deleveragePrecisionShortCollateral,
  deleveragePrecisionLongReinit,
  deleveragePrecisionShortReinit,
} from './deleveragePrecision';
import { routerSwaps } from './router';

/// @dev theme paddle front firm patient burger forward little enter pause rule limb
export const FeeHolder = '0x4c576Bf4BbF1d9AB9c359414e5D2b466bab085fa';

/// @dev tone buddy include ridge cheap because marriage sorry jungle question pretty vacuum
export const TechnicalPositionOwner = '0xDda7021A2F58a2C6E0C800692Cde7893b4462FB3';

export type SystemUnderTest = {
  uniswap: UniswapV3PoolContract;
  uniswapFactory: UniswapV3FactoryContract;
  swapRouter: MarginlyRouterContract;
  marginlyPool: MarginlyPoolContract;
  marginlyFactory: MarginlyFactoryContract;
  keeper: MarginlyKeeperContract;
  treasury: Wallet;
  accounts: Wallet[];
  usdc: FiatTokenV2_1Contract;
  weth: WETH9Contract;
  provider: Web3ProviderDecorator;
  gasReporter: GasReporter;
};

interface SuiteCollection {
  [key: string]: (sut: SystemUnderTest) => Promise<void>;
}

async function initializeTestSystem(
  provider: Web3Provider,
  suiteName: string,
  initialAccounts: [string, { unlocked: boolean; secretKey: string; balance: bigint }][]
): Promise<SystemUnderTest> {
  logger.info('Initializing');

  const count = initialAccounts.length - 1;
  const accounts: Wallet[] = [];
  for (let i = 0; i < count; ++i) {
    accounts.push(new Wallet(initialAccounts[1 + i][1].secretKey, provider));
  }
  const treasury = new Wallet(initialAccounts[0][1].secretKey, provider);

  const weth = await initWeth(treasury, provider);
  const usdc = await initUsdc(treasury, provider);

  const uniswapFactory = uniswapFactoryContract(treasury);
  logger.info(`uniswapFactory: ${uniswapFactory.address}`);
  logger.info(`uniswapFactory owner: ${await uniswapFactory.owner()}`);

  const nonFungiblePositionManager = nonFungiblePositionManagerContract(treasury);
  logger.info(`nonFungiblePositionManager: ${nonFungiblePositionManager.address}`);

  const uniswap = uniswapPoolContract(await uniswapFactory.getPool(weth.address, usdc.address, 500), provider);
  logger.info(`uniswap pool for WETH/USDC ${uniswap.address}`);

  const routerConstructorInput = [];
  routerConstructorInput.push({
    dex: Dex.UniswapV3,
    token0: weth.address,
    token1: usdc.address,
    pool: uniswap.address,
  });
  routerConstructorInput.push({
    dex: Dex.Balancer,
    token0: weth.address,
    token1: usdc.address,
    pool: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  });
  routerConstructorInput.push({
    dex: Dex.KyberSwap,
    token0: weth.address,
    token1: usdc.address,
    pool: '0xD6f8E8068012622d995744cc135A7e8e680E2E76',
  });
  routerConstructorInput.push({
    dex: Dex.SushiSwap,
    token0: weth.address,
    token1: usdc.address,
    pool: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0',
  });
  const swapRouter = await MarginlyRouter.deploy(routerConstructorInput, treasury);
  logger.info(`swap router: ${swapRouter.address}`);

  const marginlyPoolImplementation = await MarginlyPool.deploy(treasury);
  logger.info(`marginly pool implementation: ${marginlyPoolImplementation.address}`);

  const marginlyFactory = await MarginlyFactory.deploy(
    marginlyPoolImplementation.address,
    uniswapFactory.address,
    swapRouter.address,
    FeeHolder,
    weth.address,
    TechnicalPositionOwner,
    treasury
  );
  logger.info(`marginlyFactory: ${marginlyFactory.address}`);
  logger.info(`marginly owner: ${await marginlyFactory.owner()}`);

  const initialParams = {
    interestRate: 54000, // 5.4%
    fee: 20000, // 2%
    maxLeverage: 20n,
    swapFee: 1000, // 0.1%
    priceSecondsAgo: 900n, // 15 min
    positionSlippage: 20000, // 2%
    mcSlippage: 50000, //5%
    positionMinAmount: 10000000000000000n, // 0,01 ETH
    baseLimit: 10n ** 9n * 10n ** 18n,
    quoteLimit: 10n ** 12n * 10n ** 6n,
  };
  const gasReporter = new GasReporter(suiteName);
  await gasReporter.saveGasUsage(
    'factory.createPool',
    marginlyFactory.createPool(usdc.address, weth.address, 500n, initialParams)
  );

  const marginlyAddress = await marginlyFactory.getPool(weth.address, usdc.address, 500n);
  const marginlyPool = MarginlyPool.connect(marginlyAddress, provider);
  logger.info(`marginly <> uniswap: ${marginlyPool.address} <> ${uniswap.address}`);

  const aavePoolAddressesProviderAddress = '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e';
  const keeper = await MarginlyKeeper.deploy(aavePoolAddressesProviderAddress, treasury);
  logger.info(`keeper: ${keeper.address}`);

  logger.info('Initialization completed');

  return {
    accounts,
    treasury,
    usdc,
    weth,
    uniswap,
    uniswapFactory,
    marginlyFactory,
    marginlyPool,
    swapRouter,
    keeper,
    provider: new Web3ProviderDecorator(provider),
    gasReporter,
  };
}

export async function startSuite(
  provider: Web3Provider,
  initialAccounts: [string, { unlocked: boolean; secretKey: string; balance: bigint }][],
  suitName: string
): Promise<void> {
  const suits: SuiteCollection = {
    long,
    longAndShort,
    longIncome,
    short,
    shortIncome,
    simulation1,
    simulation2,
    simulation3,
    mc,
    shortEmergency,
    longEmergency,
    keeper,
    deleveragePrecisionLong,
    deleveragePrecisionShort,
    deleveragePrecisionLongCollateral,
    deleveragePrecisionShortCollateral,
    deleveragePrecisionLongReinit,
    deleveragePrecisionShortReinit,
    routerSwaps,
  };

  const suite = suits[suitName];
  if (!suite) {
    const availableTests = Object.keys(suits);
    throw `Test '${suitName}' not found. Available tests: ${availableTests}`;
  }

  logger.info(`Start test`);
  const sut = await initializeTestSystem(provider, suitName, initialAccounts);
  await suite(sut);
  logger.info(`Test suite finished successfully`);
  sut.gasReporter.reportToConsole();
  await sut.gasReporter.saveToFile();
}
