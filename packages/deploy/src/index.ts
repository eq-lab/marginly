import * as ethers from 'ethers';
import { EthAddress } from '@marginly/common';
import { MarginlyDeployConfig } from './config';
import { Logger } from './logger';
import { MarginlyDeployment, MarginlyDeploymentMarginlyPool, printDeployState, StateStore, using } from './common';
import { TokenRepository } from './TokenRepository';
import {
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
  isPendleOracle,
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

async function processPriceOracles(
  logger: Logger,
  priceOracleDeployer: PriceOracleDeployer,
  config: StrictMarginlyDeployConfig,
  tokenRepository: ITokenRepository
): Promise<Map<string, DeployResult>> {
  return await using(logger.beginScope(`Process price oracles`), async () => {
    const deployedPriceOracles = new Map<string, DeployResult>();

    for (const priceOracle of config.priceOracles) {
      if (isUniswapV3Oracle(priceOracle)) {
        const deploymentResult = await priceOracleDeployer.deployAndConfigureUniswapV3TickOracle(
          priceOracle,
          tokenRepository
        );
        printDeployState(`Price oracle ${priceOracle.id}`, deploymentResult, logger);

        deployedPriceOracles.set(priceOracle.id, deploymentResult);
      } else if (isUniswapV3DoubleOracle(priceOracle)) {
        const deploymentResult = await priceOracleDeployer.deployAndConfigureUniswapV3TickDoubleOracle(
          priceOracle,
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
      } else if (isPendleOracle(priceOracle)) {
        const deploymentResult = await priceOracleDeployer.deployAndConfigurePendleOracle(priceOracle, tokenRepository);
        printDeployState(`Price oracle ${priceOracle.id}`, deploymentResult, logger);

        deployedPriceOracles.set(priceOracle.id, deploymentResult);
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
      printDeployState(
        `Marginly adapter dexId:${adapter.dexId} name:${adapter.name}`,
        marginlyAdapterDeployResult,
        logger
      );

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
      config.marginlyFactory.techPositionOwner
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

async function processAaveKeeper(
  logger: Logger,
  keeperDeployer: KeeperDeployer,
  config: StrictMarginlyDeployConfig
): Promise<DeployResult> {
  const deployedMarginlyKeeper = await using(logger.beginScope('Process MarginlyKeeper'), async () => {
    let aavePoolAddressesProviderAddress: EthAddress;

    if (config.marginlyKeeper.uniswapKeeper) {
      // deploy uniswap v3 keeper
      throw new Error('Not implemented');
    } else if (config.marginlyKeeper.aaveKeeper) {
      const aavePoolAddressesProvider = keeperDeployer.getAavePoolAddressesProvider(
        config.marginlyKeeper.aaveKeeper.aavePoolAddressProvider
      );

      aavePoolAddressesProviderAddress = EthAddress.parse(aavePoolAddressesProvider.address);

      logger.log(`Genuine AavePoolAddressProvider is ${aavePoolAddressesProvider.address}`);
    } else if (config.marginlyKeeper.aaveMock) {
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

    const deployedPriceOracles = await processPriceOracles(logger, priceOracleDeployer, config, tokenRepository);

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

    let aaveKeeperDeployResult: DeployResult | null = null;
    if (config.marginlyKeeper.aaveKeeper) {
      aaveKeeperDeployResult = await processAaveKeeper(logger, keeperDeployer, config);
    }

    let uniswapV3Keeper: DeployResult | null = null;
    if (config.marginlyKeeper.uniswapKeeper) {
      uniswapV3Keeper = await processKeeperUniswapV3(logger, keeperUniswapV3Deployer);
    }

    return {
      marginlyPools: deployedMarginlyPools,
      aaveKeeperDeployResult: aaveKeeperDeployResult ? { address: aaveKeeperDeployResult.address } : undefined,
      uniswapV3Keeper: uniswapV3Keeper ? { address: uniswapV3Keeper.address } : undefined,
    };
  } finally {
    const balanceAfter = await signer.getBalance();
    const ethSpent = balanceBefore.sub(balanceAfter);

    logger.log(`ETH spent: ${ethers.utils.formatEther(ethSpent)}`);
  }
}
