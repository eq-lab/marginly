import { ethers, Wallet } from 'ethers';
import { logger } from '../utils/logger';
import { Web3Provider } from '@ethersproject/providers';
import { initUsdc, initWeth } from '../utils/erc20-init';
import {
  uniswapFactoryContract,
  uniswapPoolContract,
  nonFungiblePositionManagerContract,
} from '../utils/known-contracts';
import { Dex, Web3ProviderDecorator } from '../utils/chain-ops';
import MarginlyFactory, { MarginlyFactoryContract } from '../contract-api/MarginlyFactory';
import MarginlyPool, { MarginlyPoolContract } from '../contract-api/MarginlyPool';
import { UniswapV3PoolContract } from '../contract-api/UniswapV3Pool';
import { UniswapV3FactoryContract } from '../contract-api/UniswapV3Factory';
import { FiatTokenV2_1Contract } from '../contract-api/FiatTokenV2';
import { WETH9Contract } from '../contract-api/WETH9';
import { long } from './long';
import { short } from './short';
import { longAndShort } from './long_and_short';
import { longIncome } from './long_income';
import { shortIncome } from './short_income';
import { GasReporter } from '../utils/GasReporter';
import { simulation1, simulation2, simulation3 } from './simulation';
import { longEmergency, shortEmergency } from './shutdown';
import MarginlyKeeper, { MarginlyKeeperContract } from '../contract-api/MarginlyKeeper';
import { keeperAave } from './keeperAave';
import MarginlyRouter, { MarginlyRouterContract } from '../contract-api/MarginlyRouter';
import BalancerMarginlyAdapter from '../contract-api/BalancerMarginlyAdapter';
import KyberClassicMarginlyAdapter from '../contract-api/KyberClassicMarginlyAdapter';
import UniswapV2MarginlyAdapter from '../contract-api/UniswapV2MarginlyAdapter';
import UniswapV3MarginlyAdapter from '../contract-api/UniswapV3MarginlyAdapter';
import {
  deleveragePrecisionLong,
  deleveragePrecisionShort,
  deleveragePrecisionLongCollateral,
  deleveragePrecisionShortCollateral,
  deleveragePrecisionLongReinit,
  deleveragePrecisionShortReinit,
} from './deleveragePrecision';
import { balanceSync, balanceSyncWithdrawBase, balanceSyncWithdrawQuote } from './balanceSync';
import { routerSwaps, routerMultipleSwaps } from './router';
import DodoV1MarginlyAdapter from '../contract-api/DodoV1MarginlyAdapter';
import DodoV2MarginlyAdapter from '../contract-api/DodoV2MarginlyAdapter';
import { parseUnits } from 'ethers/lib/utils';
import MarginlyKeeperUniswapV3, { MarginlyKeeperUniswapV3Contract } from '../contract-api/MarginlyKeeperUniswapV3';
import { keeperUniswapV3 } from './keeperUniswapV3';
import UniswapV3TickOracle from '../contract-api/UniswapV3TickOracle';

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
  keeperAave: MarginlyKeeperContract;
  keeperUniswapV3: MarginlyKeeperUniswapV3Contract;
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

  const uniswapAdapter = await UniswapV3MarginlyAdapter.deploy(
    [{ token0: weth.address, token1: usdc.address, pool: uniswap.address }],
    treasury
  );

  const kyberClassicAdapter = await KyberClassicMarginlyAdapter.deploy(
    [{ token0: weth.address, token1: usdc.address, pool: '0xD6f8E8068012622d995744cc135A7e8e680E2E76' }],
    treasury
  );

  const sushiSwapAdapter = await UniswapV2MarginlyAdapter.deploy(
    [{ token0: weth.address, token1: usdc.address, pool: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0' }],
    treasury
  );

  const balancerVault = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
  const balancerAdapter = await BalancerMarginlyAdapter.deploy(
    [{ token0: weth.address, token1: usdc.address, pool: '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8' }],
    balancerVault,
    treasury
  );

  const dodoV1Adapter = await DodoV1MarginlyAdapter.deploy(
    [{ token0: weth.address, token1: usdc.address, pool: '0x75c23271661d9d143DCb617222BC4BEc783eff34' }],
    treasury
  );

  const dodoV2Pool = '0xCFA990E9c104F6DB3fbECEe04ad211c39ED3830F';
  await weth.connect(treasury).transfer(dodoV2Pool, parseUnits('110', 18));
  await usdc.connect(treasury).transfer(dodoV2Pool, parseUnits('100000', 6));
  const dodoV2SyncAbi =
    '[{"inputs": [], "name": "sync", "outputs": [], "stateMutability": "nonpayable", "type": "function"}]';
  const dodoV2 = new ethers.Contract(dodoV2Pool, dodoV2SyncAbi);
  await dodoV2.connect(treasury).sync();

  const dodoV2Adapter = await DodoV2MarginlyAdapter.deploy(
    [{ token0: weth.address, token1: usdc.address, pool: dodoV2Pool }],
    treasury
  );

  const routerConstructorInput = [];
  routerConstructorInput.push({
    dexIndex: Dex.UniswapV3,
    adapter: uniswapAdapter.address,
  });
  routerConstructorInput.push({
    dexIndex: Dex.Balancer,
    adapter: balancerAdapter.address,
  });
  routerConstructorInput.push({
    dexIndex: Dex.KyberClassicSwap,
    adapter: kyberClassicAdapter.address,
  });
  routerConstructorInput.push({
    dexIndex: Dex.SushiSwap,
    adapter: sushiSwapAdapter.address,
  });
  routerConstructorInput.push({
    dexIndex: Dex.DodoV1,
    adapter: dodoV1Adapter.address,
  });
  routerConstructorInput.push({
    dexIndex: Dex.DodoV2,
    adapter: dodoV2Adapter.address,
  });
  const swapRouter = await MarginlyRouter.deploy(routerConstructorInput, treasury);
  logger.info(`swap router: ${swapRouter.address}`);

  const priceOracle = await UniswapV3TickOracle.deploy(uniswapFactory.address, treasury);
  logger.info(`price oracle: ${priceOracle.address}`);

  const secondsAgo = 1800;
  const secondsAgoLiquidation = 5;
  const uniswapPoolFee = 500;
  const priceOracleOptions = ethers.utils.defaultAbiCoder.encode(
    ['uint16', 'uint16', 'uint24'],
    [secondsAgo, secondsAgoLiquidation, uniswapPoolFee]
  );
  //'0x0000000000000000000000000000000000000000000000000000000000000708000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000001f4';
  await priceOracle.connect(treasury).setOptions(usdc.address, weth.address, priceOracleOptions); //TODO: create uniswap price oracle

  const marginlyPoolImplementation = await MarginlyPool.deploy(treasury);
  logger.info(`marginly pool implementation: ${marginlyPoolImplementation.address}`);

  const marginlyFactory = await MarginlyFactory.deploy(
    marginlyPoolImplementation.address,
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
    positionSlippage: 20000, // 2%
    mcSlippage: 50000, //5%
    positionMinAmount: 10000000000000000n, // 0,01 ETH
    quoteLimit: 10n ** 12n * 10n ** 6n,
  };

  const defaultSwapCallData = 0;
  const gasReporter = new GasReporter(suiteName);
  const txReceipt = await gasReporter.saveGasUsage(
    'factory.createPool',
    marginlyFactory.createPool(usdc.address, weth.address, priceOracle.address, defaultSwapCallData, initialParams)
  );

  const poolCreatedEvents = txReceipt.events?.filter((x) => x.event === 'PoolCreated');
  if (!poolCreatedEvents || poolCreatedEvents.length === 0 || !poolCreatedEvents[0].args) {
    throw new Error('PoolCreated event is not found');
  }
  const marginlyAddress = poolCreatedEvents[0].args[4];

  //const marginlyAddress = await marginlyFactory.getPool(weth.address, usdc.address, 500n);
  const marginlyPool = MarginlyPool.connect(marginlyAddress, provider);
  logger.info(`marginly <> uniswap: ${marginlyPool.address} <> ${uniswap.address}`);

  const aavePoolAddressesProviderAddress = '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e';
  const keeperAave = await MarginlyKeeper.deploy(aavePoolAddressesProviderAddress, treasury);
  logger.info(`keeperAave: ${keeperAave.address}`);

  const keeperUniswapV3 = await MarginlyKeeperUniswapV3.deploy(treasury);
  logger.info(`keeperUniswapV3: ${keeperUniswapV3.address}`);

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
    keeperAave,
    keeperUniswapV3,
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
    shortEmergency,
    longEmergency,
    keeperAave,
    keeperUniswapV3,
    deleveragePrecisionLong,
    deleveragePrecisionShort,
    deleveragePrecisionLongCollateral,
    deleveragePrecisionShortCollateral,
    deleveragePrecisionLongReinit,
    deleveragePrecisionShortReinit,
    balanceSync,
    balanceSyncWithdrawBase,
    balanceSyncWithdrawQuote,
    routerSwaps,
    routerMultipleSwaps,
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
