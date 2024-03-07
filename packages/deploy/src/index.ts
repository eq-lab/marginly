import * as ethers from 'ethers';
import { EthAddress, RationalNumber } from '@marginly/common';
import { Dex, MarginlyDeployConfig } from './config';
import { priceToPriceFp27, priceToSqrtPriceX96, sortUniswapPoolTokens } from '@marginly/common/math';
import { Logger } from './logger';
import { MarginlyDeployment, MarginlyDeploymentMarginlyPool, printDeployState, StateStore, using } from './common';
import { TokenRepository } from './TokenRepository';
import {
  isMarginlyConfigUniswapGenuine,
  isMarginlyConfigUniswapMock,
  isUniswapV3DoubleOracle,
  isUniswapV3Oracle,
  StrictMarginlyDeployConfig,
  MarginlyDeployer,
  PriceOracleDeployer,
  UniswapV3Deployer,
  KeeperDeployer,
  MockTokenDeployer,
  MarginlyRouterDeployer,
  isChainlinkOracle,
  isPythOracle,
  KeeperUniswapV3Deployer,
} from './deployer';
import { Contract } from 'ethers';
import { DeployResult, ITokenRepository } from './common/interfaces';
export { DeployConfig } from './config';
export { DeployState, StateStore, BaseState, MarginlyDeployment, mergeMarginlyDeployments } from './common';
export { Logger, SimpleLogger } from './logger';

export interface MarginlyDeployBundle {
  name: string;
  config: MarginlyDeployConfig;
  deployment?: MarginlyDeployment;
}

export async function getMarginlyDeployBundles(logger: Logger): Promise<MarginlyDeployBundle[]> {
  const dirs = require('./data/deploy/index.json');

  const result: MarginlyDeployBundle[] = [];

  for (const dir of dirs) {
    const config: MarginlyDeployConfig = require(`./data/deploy/${dir}/config.json`);
    let deployment: MarginlyDeployment | undefined;

    try {
      deployment = require(`./data/deploy/${dir}/deployment.json`);
    } catch (err) {
      logger.log(`Deployment file for ${dir} deployment is not found`);
    }

    result.push({
      name: dir,
      config,
      deployment,
    });
  }

  return result;
}

async function initializeDeployers(
  signer: ethers.Signer,
  rawConfig: MarginlyDeployConfig,
  stateStore: StateStore,
  logger: Logger
) {
  return await using(logger.beginScope('Initialize'), async () => {
    if (signer.provider === undefined) {
      throw new Error('Provider is required');
    }

    const provider = signer.provider;

    const config = await StrictMarginlyDeployConfig.fromConfig(logger, rawConfig);

    if (config.connection.assertChainId !== undefined) {
      const expectedChainId = config.connection.assertChainId;
      const { chainId: actualChainId } = await provider.getNetwork();
      if (actualChainId !== expectedChainId) {
        throw new Error(`Wrong chain id ${actualChainId}. Expected to be ${expectedChainId}`);
      }
    }

    const ethOptions = config.connection.ethOptions;

    const marginlyDeployer = new MarginlyDeployer(signer, ethOptions, stateStore, logger);
    const priceOracleDeployer = new PriceOracleDeployer(signer, ethOptions, stateStore, logger);
    const keeperDeployer = new KeeperDeployer(signer, ethOptions, stateStore, logger);
    const uniswapV3Deployer = new UniswapV3Deployer(signer, ethOptions, stateStore, logger);
    const mockTokenDeployer = new MockTokenDeployer(signer, ethOptions, stateStore, logger);
    const marginlyRouterDeployer = new MarginlyRouterDeployer(signer, ethOptions, stateStore, logger);
    const keeperUniswapV3Deployer = new KeeperUniswapV3Deployer(signer, ethOptions, stateStore, logger);

    return {
      config,
      provider,
      marginlyDeployer,
      priceOracleDeployer,
      keeperDeployer,
      uniswapV3Deployer,
      mockTokenDeployer,
      marginlyRouterDeployer,
      keeperUniswapV3Deployer,
    };
  });
}

async function processTokens(
  logger: Logger,
  provider: ethers.ethers.providers.Provider,
  mockTokenDeployer: MockTokenDeployer,
  config: StrictMarginlyDeployConfig
): Promise<ITokenRepository> {
  return await using(logger.beginScope('Process tokens'), async () => {
    const tokenRepository = new TokenRepository(provider, mockTokenDeployer, logger);

    for (const token of config.tokens) {
      await tokenRepository.materializeToken(token);
    }

    return tokenRepository;
  });
}

export type RouterPool = { dex: number; token0: EthAddress; token1: EthAddress; pool: EthAddress };

async function processUniswap(
  logger: Logger,
  signer: ethers.Signer,
  tokenRepository: ITokenRepository,
  uniswapV3Deployer: UniswapV3Deployer,
  mockTokenDeployer: MockTokenDeployer,
  marginlyDeployer: MarginlyDeployer,
  config: StrictMarginlyDeployConfig
): Promise<{ uniswapFactoryAddress: EthAddress; routerPools: RouterPool[] }> {
  return await using(logger.beginScope('Process uniswap'), async () => {
    const routerPools: RouterPool[] = [];

    if (isMarginlyConfigUniswapGenuine(config.uniswap)) {
      const uniswapConfig = config.uniswap;

      logger.log('Create genuine uniswap pools');

      for (const pool of uniswapConfig.pools) {
        routerPools.push({
          dex: Dex.UniswapV3,
          token0: tokenRepository.getTokenInfo(pool.tokenA.id).address,
          token1: tokenRepository.getTokenInfo(pool.tokenB.id).address,
          pool: pool.assertAddress!,
        });
        const uniswapPoolDeploymentResult = await uniswapV3Deployer.getOrCreateUniswapPoolGenuine(
          uniswapConfig.factory,
          pool,
          tokenRepository
        );
        printDeployState(`Uniswap Pool '${pool.id}'`, uniswapPoolDeploymentResult, logger);
      }

      return {
        uniswapFactoryAddress: config.uniswap.factory,
        routerPools,
      };
    } else if (isMarginlyConfigUniswapMock(config.uniswap)) {
      logger.log('Create mock uniswap factory and pools');

      const uniswapConfig = config.uniswap;

      const uniswapRouterDeploymentResult = await uniswapV3Deployer.deployUniswapRouterMock(
        uniswapConfig.weth9Token,
        tokenRepository
      );
      printDeployState('UniswapRouterMock', uniswapRouterDeploymentResult, logger);

      const uniswapRouterContract = uniswapRouterDeploymentResult.contract;
      await uniswapRouterContract.setRejectArbitraryRecipient(true);

      const uniswapV3FactoryMockDeploymentResult = await uniswapV3Deployer.deployUniswapV3FactoryMock();
      printDeployState('UniswapFactoryMock', uniswapV3FactoryMockDeploymentResult, logger);
      const uniswapV3Factory = uniswapV3FactoryMockDeploymentResult.contract;

      for (const pool of uniswapConfig.pools) {
        const uniswapPoolDeploymentResult = await uniswapV3Deployer.getOrCreateUniswapV3PoolMock(
          uniswapV3Factory,
          uniswapConfig.oracle,
          pool,
          tokenRepository
        );
        printDeployState(`UniswapPoolMock ${pool.id} deployed`, uniswapPoolDeploymentResult, logger);

        const { address: tokenAAddress } = tokenRepository.getTokenInfo(pool.tokenA.id);
        const { address: tokenBAddress } = tokenRepository.getTokenInfo(pool.tokenB.id);

        routerPools.push({
          dex: Dex.UniswapV3,
          token0: tokenAAddress,
          token1: tokenBAddress,
          pool: EthAddress.parse(uniswapPoolDeploymentResult.address),
        });

        const uniswapFee = uniswapV3Deployer.toUniswapFee(pool.fee);
        await uniswapRouterContract.setPool(
          tokenAAddress.toString(),
          tokenBAddress.toString(),
          uniswapFee,
          uniswapPoolDeploymentResult.address
        );

        const [token0, token1] = sortUniswapPoolTokens(
          [tokenAAddress.toString(), tokenBAddress.toString()],
          [pool.tokenA, pool.tokenB]
        );

        const priceToken = pool[pool.priceBaseTokenKey];
        let price: number;
        if (token0.id === priceToken.id) {
          price = pool.price;
        } else {
          price = 1 / pool.price;
        }

        const { decimals: token0Decimals } = tokenRepository.getTokenInfo(token0.id);
        const { decimals: token1Decimals } = tokenRepository.getTokenInfo(token1.id);

        const priceFp27 = priceToPriceFp27(price, token0Decimals, token1Decimals);
        const sqrtPriceX96 = priceToSqrtPriceX96(price, token0Decimals, token1Decimals);

        const uniswapPoolContract = uniswapPoolDeploymentResult.contract;

        await uniswapPoolContract.setPrice(priceFp27, sqrtPriceX96);

        const observationCardinality = config.uniswap.priceLogSize;
        await uniswapPoolContract.increaseObservationCardinalityNext(observationCardinality);
        await uniswapPoolContract.setAllowListEnabled(true);
        await uniswapPoolContract.addToAllowList(uniswapRouterDeploymentResult.address);

        const uniswapPoolAddress = EthAddress.parse(uniswapPoolDeploymentResult.address);

        if (pool.tokenABalance !== undefined) {
          await mockTokenDeployer.ensureTokenAmount(
            pool.tokenA,
            uniswapPoolAddress,
            pool.tokenABalance,
            tokenRepository
          );
        }
        if (pool.tokenBBalance !== undefined) {
          await mockTokenDeployer.ensureTokenAmount(
            pool.tokenB,
            uniswapPoolAddress,
            pool.tokenBBalance,
            tokenRepository
          );
        }
        const ownerAddress = EthAddress.parse(await signer.getAddress());
        await mockTokenDeployer.ensureTokenAmount(
          pool.tokenA,
          ownerAddress,
          RationalNumber.parse('1_000_000'),
          tokenRepository
        );
        await mockTokenDeployer.ensureTokenAmount(
          pool.tokenB,
          ownerAddress,
          RationalNumber.parse('1_000_000'),
          tokenRepository
        );
      }

      return {
        uniswapFactoryAddress: EthAddress.parse(uniswapV3Factory.address),
        routerPools,
      };
    } else {
      /* else if (isMarginlyConfigSwapPoolRegistry(config.uniswap)) {
      const swapPoolRegistryConfig = config.uniswap;
      const priceAdapters: EthAddress[] = [];
      const priceProvidersMockDeployAddresses = new Map<string, string>();
      for (const pool of swapPoolRegistryConfig.pools) {
        if (pool.priceAdapter.priceProvidersMock !== undefined) {
          const { basePriceProviderMock, quotePriceProviderMock } = pool.priceAdapter.priceProvidersMock;
          for (const { priceProviderMock, tag } of [
            { priceProviderMock: basePriceProviderMock, tag: 'base' },
            { priceProviderMock: quotePriceProviderMock, tag: 'quote' },
          ]) {
            if (priceProviderMock !== undefined) {
              await using(logger.beginScope('Deploy PriceProviderMock'), async () => {
                const deployResult = await marginlyDeployer.deployPriceProviderMock(
                  priceProviderMock,
                  `${tag}_${pool.id}`
                );
                printDeployState(`PriceProviderMock`, deployResult, logger);
                priceProvidersMockDeployAddresses.set(tag, deployResult.address);
              });
            }
          }
        }

        const basePriceProviderMockAddress = priceProvidersMockDeployAddresses.get('base');
        const basePriceProvider =
          basePriceProviderMockAddress === undefined
            ? pool.priceAdapter.basePriceProvider!
            : EthAddress.parse(basePriceProviderMockAddress);

        const quotePriceProviderMockAddress = priceProvidersMockDeployAddresses.get('quote');
        const quotePriceProvider =
          quotePriceProviderMockAddress === undefined
            ? pool.priceAdapter.quotePriceProvider || EthAddress.parse('0x0000000000000000000000000000000000000000')
            : EthAddress.parse(quotePriceProviderMockAddress);

        const priceAdapterDeployResult = await using(logger.beginScope('Deploy PriceAdapter'), async () => {
          const deployResult = await marginlyDeployer.deployMarginlyPriceAdapter(
            basePriceProvider,
            quotePriceProvider,
            pool.id
          );
          printDeployState(`PriceAdapter`, deployResult, logger);
          return deployResult;
        });
        priceAdapters.push(EthAddress.parse(priceAdapterDeployResult.address));
      }

      const swapPoolDeploymentResult = await using(logger.beginScope('Deploy SwapPoolRegistry'), async () => {
        const deployResult = await marginlyDeployer.deploySwapPoolRegistry(
          tokenRepository,
          swapPoolRegistryConfig.factory,
          swapPoolRegistryConfig.pools,
          priceAdapters
        );
        printDeployState(`SwapPoolRegistry`, deployResult, logger);
        return deployResult;
      });

      return {
        uniswapFactoryAddress: EthAddress.parse(swapPoolDeploymentResult.address),
        routerPools,
      };
    }*/
      throw new Error('Unknown Uniswap type');
    }
  });
}

async function processPriceOracles(
  logger: Logger,
  priceOracleDeployer: PriceOracleDeployer,
  config: StrictMarginlyDeployConfig,
  uniswapFactoryAddress: EthAddress,
  tokenRepository: ITokenRepository
): Promise<Map<string, DeployResult>> {
  return await using(logger.beginScope(`Process price oracles`), async () => {
    const deployedPriceOracles = new Map<string, DeployResult>();

    for (const priceOracle of config.priceOracles) {
      if (isUniswapV3Oracle(priceOracle)) {
        const deploymentResult = await priceOracleDeployer.deployAndConfigureUniswapV3TickOracle(
          priceOracle,
          uniswapFactoryAddress,
          tokenRepository
        );
        printDeployState(`Price oracle ${priceOracle.id}`, deploymentResult, logger);

        deployedPriceOracles.set(priceOracle.id, deploymentResult);
      } else if (isUniswapV3DoubleOracle(priceOracle)) {
        const deploymentResult = await priceOracleDeployer.deployAndConfigureUniswapV3TickDoubleOracle(
          priceOracle,
          uniswapFactoryAddress,
          tokenRepository
        );
        printDeployState(`Price oracle ${priceOracle.id}`, deploymentResult, logger);

        deployedPriceOracles.set(priceOracle.id, deploymentResult);
      } else if (isChainlinkOracle(priceOracle)) {
        const deploymentResult = await priceOracleDeployer.deployAndConfigureChainlinkOracle(
          priceOracle,
          tokenRepository
        );
        printDeployState(`Price oracle ${priceOracle.id}`, deploymentResult, logger);
      } else if (isPythOracle(priceOracle)) {
        const deploymentResult = await priceOracleDeployer.deployAndConfigurePythOracle(priceOracle, tokenRepository);
        printDeployState(`Price oracle ${priceOracle.id}`, deploymentResult, logger);
      } else {
        throw new Error(`Unknown priceOracle type`);
      }
    }

    return deployedPriceOracles;
  });
}

async function processMarginlyRouter(
  logger: Logger,
  marginlyRouterDeployer: MarginlyRouterDeployer,
  tokenRepository: ITokenRepository,
  config: StrictMarginlyDeployConfig
) {
  return await using(logger.beginScope('Process marginly router'), async () => {
    const adapterDeployResults: { dexId: ethers.BigNumber; adapter: EthAddress; contract: Contract }[] = [];

    for (const adapter of config.marginlyRouter.adapters) {
      const marginlyAdapterDeployResult = await marginlyRouterDeployer.deployMarginlyAdapter(
        tokenRepository,
        adapter.dexId,
        adapter.name,
        adapter.marginlyAdapterParams,
        adapter.balancerVault
      );
      printDeployState('Marginly adapter', marginlyAdapterDeployResult, logger);

      adapterDeployResults.push({
        dexId: adapter.dexId,
        adapter: EthAddress.parse(marginlyAdapterDeployResult.address),
        contract: marginlyAdapterDeployResult.contract,
      });
    }

    const marginlyRouterDeployResult = await marginlyRouterDeployer.deployMarginlyRouter(adapterDeployResults);
    printDeployState('Marginly router', marginlyRouterDeployResult, logger);

    return marginlyRouterDeployResult;
  });
}

async function processMarginly(
  logger: Logger,
  marginlyDeployer: MarginlyDeployer,
  config: StrictMarginlyDeployConfig,
  tokenRepository: ITokenRepository,
  marginlyRouterDeployResult: DeployResult,
  deployedPriceOracles: Map<string, DeployResult>
) {
  const marginlyPoolImplDeployResult = await using(
    logger.beginScope('Deploy marginly pool implementation'),
    async () => {
      const marginlyPoolImplDeployResult = await marginlyDeployer.deployMarginlyPoolImplementation();
      printDeployState('Marginly pool implementation', marginlyPoolImplDeployResult, logger);

      return marginlyPoolImplDeployResult;
    }
  );

  const marginlyFactoryDeployResult = await using(logger.beginScope('Deploy marginly factory'), async () => {
    const marginlyFactoryDeployResult = await marginlyDeployer.deployMarginlyFactory(
      EthAddress.parse(marginlyPoolImplDeployResult.contract.address),
      EthAddress.parse(marginlyRouterDeployResult.address),
      config.marginlyFactory.feeHolder,
      config.marginlyFactory.weth9Token,
      tokenRepository,
      config.marginlyFactory.techPositionOwner,
      config.marginlyFactory.blastPointsAdmin
    );
    printDeployState('Marginly Factory', marginlyFactoryDeployResult, logger);

    return marginlyFactoryDeployResult;
  });

  const deployedMarginlyPools = await using(logger.beginScope('Create marginly pools'), async () => {
    const deployedMarginlyPools: MarginlyDeploymentMarginlyPool[] = [];
    for (const pool of config.marginlyPools) {
      const priceOracle = deployedPriceOracles.get(pool.priceOracle.id);
      if (!priceOracle) {
        throw new Error(`Price oracle address with id ${pool.priceOracle.id} not found`);
      }

      const marginlyPoolDeploymentResult = await marginlyDeployer.getOrCreateMarginlyPool(
        marginlyFactoryDeployResult.contract,
        pool,
        tokenRepository,
        EthAddress.parse(priceOracle.address)
      );
      deployedMarginlyPools.push({
        id: pool.id,
        address: marginlyPoolDeploymentResult.address,
      });
      printDeployState(`Marginly Pool '${pool.id}'`, marginlyPoolDeploymentResult, logger);
    }
    return deployedMarginlyPools;
  });

  return {
    marginlyPoolImplDeployResult,
    marginlyFactoryDeployResult,
    deployedMarginlyPools,
  };
}

async function processKeeper(
  logger: Logger,
  keeperDeployer: KeeperDeployer,
  config: StrictMarginlyDeployConfig
): Promise<DeployResult> {
  const deployedMarginlyKeeper = await using(logger.beginScope('Process MarginlyKeeper'), async () => {
    let aavePoolAddressesProviderAddress: EthAddress;

    if (config.marginlyKeeper.aavePoolAddressesProvider.allowCreateMock) {
      const deployedMockAavePool = await using(logger.beginScope('Deploy MockAavePool'), async () => {
        const deploymentResult = await keeperDeployer.getOrCreateMockAavePool();
        printDeployState(`Mock AAVE pool`, deploymentResult, logger);
        return deploymentResult;
      });

      const deployedMockAavePoolAddressesProvider = await using(
        logger.beginScope('Deploy MockAavePoolAddressesProvider'),
        async () => {
          const deploymentResult = await keeperDeployer.getOrCreateMockAavePoolAddressesProvider(
            EthAddress.parse(deployedMockAavePool.address)
          );
          printDeployState(`MockAavePoolAddressesProvider`, deploymentResult, logger);
          return deploymentResult;
        }
      );
      aavePoolAddressesProviderAddress = EthAddress.parse(deployedMockAavePoolAddressesProvider.address);
    } else if (config.marginlyKeeper.aavePoolAddressesProvider.address) {
      const aavePoolAddressesProvider = keeperDeployer.getAavePoolAddressesProvider(
        config.marginlyKeeper.aavePoolAddressesProvider.address
      );

      aavePoolAddressesProviderAddress = EthAddress.parse(aavePoolAddressesProvider.address);

      logger.log(`Genuine AavePoolAddressProvider is ${aavePoolAddressesProvider.address}`);
    } else {
      throw new Error('Marginly keeper configuraiton error');
    }

    const deploymentResult = await keeperDeployer.deployMarginlyKeeper(aavePoolAddressesProviderAddress);
    printDeployState(`Marginly keeper`, deploymentResult, logger);
    return deploymentResult;
  });

  return deployedMarginlyKeeper;
}

async function processKeeperUniswapV3(
  logger: Logger,
  keeperUniswapV3Deployer: KeeperUniswapV3Deployer
): Promise<DeployResult> {
  const deployResult = await using(logger.beginScope('Process MarginlyKeeper'), async () => {
    return keeperUniswapV3Deployer.deployKeeper();
  });

  return deployResult;
}

export async function deployMarginly(
  signer: ethers.Signer,
  rawConfig: MarginlyDeployConfig,
  stateStore: StateStore,
  logger: Logger
): Promise<MarginlyDeployment> {
  const {
    config,
    provider,
    marginlyDeployer,
    priceOracleDeployer,
    keeperDeployer,
    uniswapV3Deployer,
    mockTokenDeployer,
    marginlyRouterDeployer,
    keeperUniswapV3Deployer,
  } = await initializeDeployers(signer, rawConfig, stateStore, logger);

  const balanceBefore = await signer.getBalance();

  try {
    const tokenRepository = await processTokens(logger, provider, mockTokenDeployer, config);

    const { uniswapFactoryAddress } = await processUniswap(
      logger,
      signer,
      tokenRepository,
      uniswapV3Deployer,
      mockTokenDeployer,
      marginlyDeployer,
      config
    );

    const deployedPriceOracles = await processPriceOracles(
      logger,
      priceOracleDeployer,
      config,
      uniswapFactoryAddress,
      tokenRepository
    );

    const marginlyRouterDeployResult = await processMarginlyRouter(
      logger,
      marginlyRouterDeployer,
      tokenRepository,
      config
    );

    const { deployedMarginlyPools } = await processMarginly(
      logger,
      marginlyDeployer,
      config,
      tokenRepository,
      marginlyRouterDeployResult,
      deployedPriceOracles
    );

    const marginlyKeeperDeployResult = await processKeeper(logger, keeperDeployer, config);

    const keeperUniswapV3DeployResult = await processKeeperUniswapV3(logger, keeperUniswapV3Deployer);

    return {
      marginlyPools: deployedMarginlyPools,
      marginlyKeeper: { address: marginlyKeeperDeployResult.address },
      marginlyKeeperUniswapV3: { address: keeperUniswapV3DeployResult.address },
    };
  } finally {
    const balanceAfter = await signer.getBalance();
    const ethSpent = balanceBefore.sub(balanceAfter);

    logger.log(`ETH spent: ${ethers.utils.formatEther(ethSpent)}`);
  }
}
