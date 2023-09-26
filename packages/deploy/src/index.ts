import * as ethers from 'ethers';
import { EthAddress, RationalNumber } from '@marginly/common';
import { Dex, MarginlyDeployConfig } from './config';
import { priceToPriceFp18, priceToSqrtPriceX96, sortUniswapPoolTokens } from '@marginly/common/math';
import { Logger } from './logger';
import {
  getMarginlyKeeperAddress,
  MarginlyDeployment,
  MarginlyDeploymentMarginlyPool,
  printDeployState,
  StateStore,
  using,
} from './common';
import { MarginlyDeployer } from './deployer';
import { TokenRepository } from './token-repository';
import {
  isMarginlyConfigUniswapGenuine,
  isMarginlyConfigUniswapMock,
  MarginlyConfigMarginlyRouter,
  StrictMarginlyDeployConfig,
} from './deployer/configs';
import { DeployResult } from './common/interfaces';

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

export async function deployMarginly(
  signer: ethers.Signer,
  rawConfig: MarginlyDeployConfig,
  stateStore: StateStore,
  logger: Logger
): Promise<MarginlyDeployment> {
  const { config, provider, marginlyDeployer } = await using(logger.beginScope('Initialize'), async () => {
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

    const marginlyDeployer = new MarginlyDeployer(signer, config.connection.ethOptions, stateStore, logger);

    return { config, provider, marginlyDeployer };
  });

  const balanceBefore = await signer.getBalance();

  try {
    const tokenRepository = await using(logger.beginScope('Process tokens'), async () => {
      const tokenRepository = new TokenRepository(provider, marginlyDeployer);

      for (const token of config.tokens) {
        await tokenRepository.materializeToken(token);
      }

      return tokenRepository;
    });

    const routerPools: { dex: number; token0: EthAddress; token1: EthAddress; pool: EthAddress }[] = [];

    const uniswapFactoryAddress = await using(logger.beginScope('Process uniswap'), async () => {
      if (isMarginlyConfigUniswapGenuine(config.uniswap)) {
        const uniswapConfig = config.uniswap;
        await using(logger.beginScope('Create uniswap pools'), async () => {
          for (const pool of uniswapConfig.pools) {
            routerPools.push({
              dex: Dex.UniswapV3,
              token0: tokenRepository.getTokenInfo(pool.tokenA.id).address,
              token1: tokenRepository.getTokenInfo(pool.tokenB.id).address,
              pool: pool.assertAddress!,
            });
            const uniswapPoolDeploymentResult = await marginlyDeployer.getOrCreateUniswapPoolGenuine(
              uniswapConfig.factory,
              pool,
              tokenRepository
            );
            printDeployState(`Uniswap Pool '${pool.id}'`, uniswapPoolDeploymentResult, logger);
          }
        });
        return config.uniswap.factory;
      } else if (isMarginlyConfigUniswapMock(config.uniswap)) {
        const uniswapConfig = config.uniswap;
        const uniswapRouterDeploymentResult = await marginlyDeployer.deployUniswapRouterMock(
          uniswapConfig.weth9Token,
          tokenRepository
        );
        const uniswapRouterContract = uniswapRouterDeploymentResult.contract;
        await uniswapRouterContract.setRejectArbitraryRecipient(true);
        for (const pool of uniswapConfig.pools) {
          const uniswapPoolDeploymentResult = await marginlyDeployer.deployUniswapPoolMock(
            uniswapConfig.oracle,
            pool,
            tokenRepository
          );
          routerPools.push({
            dex: Dex.UniswapV3,
            token0: tokenRepository.getTokenInfo(pool.tokenA.id).address,
            token1: tokenRepository.getTokenInfo(pool.tokenB.id).address,
            pool: EthAddress.parse(uniswapPoolDeploymentResult.address),
          });
          const { address: tokenAAddress } = tokenRepository.getTokenInfo(pool.tokenA.id);
          const { address: tokenBAddress } = tokenRepository.getTokenInfo(pool.tokenB.id);
          const uniswapFee = marginlyDeployer.toUniswapFee(pool.fee);
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

          const priceFp18 = priceToPriceFp18(price, token0Decimals, token1Decimals);
          const sqrtPriceX96 = priceToSqrtPriceX96(price, token0Decimals, token1Decimals);

          const uniswapPoolContract = uniswapPoolDeploymentResult.contract;

          await uniswapPoolContract.setPrice(priceFp18, sqrtPriceX96);
          await uniswapPoolContract.increaseObservationCardinalityNext(config.uniswap.priceLogSize);

          await uniswapPoolContract.setAllowListEnabled(true);
          await uniswapPoolContract.addToAllowList(uniswapRouterDeploymentResult.address);

          const uniswapPoolAddress = EthAddress.parse(uniswapPoolDeploymentResult.address);

          if (pool.tokenABalance !== undefined) {
            await marginlyDeployer.ensureTokenAmount(
              pool.tokenA,
              uniswapPoolAddress,
              pool.tokenABalance,
              tokenRepository
            );
          }
          if (pool.tokenBBalance !== undefined) {
            await marginlyDeployer.ensureTokenAmount(
              pool.tokenB,
              uniswapPoolAddress,
              pool.tokenBBalance,
              tokenRepository
            );
          }
          const ownerAddress = EthAddress.parse(await signer.getAddress());
          await marginlyDeployer.ensureTokenAmount(
            pool.tokenA,
            ownerAddress,
            RationalNumber.parse('1_000_000'),
            tokenRepository
          );
          await marginlyDeployer.ensureTokenAmount(
            pool.tokenB,
            ownerAddress,
            RationalNumber.parse('1_000_000'),
            tokenRepository
          );
        }

        return EthAddress.parse(uniswapRouterDeploymentResult.address);
      } else {
        throw new Error('Unknown Uniswap type');
      }
    });

    const marginlyRouterDeployResult = await using(logger.beginScope('Deploy marginly router'), async () => {
      const adapterDeployResults: { dexId: ethers.BigNumber, adapter: EthAddress }[] = [];
      for (const adapter of config.marginlyRouter.adapters) {
        await using(logger.beginScope('Deploy marginly adapter'), async () => {
          const marginlyAdapterDeployResult = await marginlyDeployer.deployMarginlyAdapter(
            tokenRepository,
            adapter.dexId,
            adapter.name,
            adapter.marginlyAdapterParams,
            adapter.balancerVault
          );
          printDeployState('Marginly adapter', marginlyAdapterDeployResult, logger);
          adapterDeployResults.push({
            dexId: adapter.dexId, 
            adapter: EthAddress.parse(marginlyAdapterDeployResult.address)
          });
        }); 
      }

      const marginlyRouterDeployResult = await marginlyDeployer.deployMarginlyRouter(adapterDeployResults);
      printDeployState('Marginly router', marginlyRouterDeployResult, logger);

      return marginlyRouterDeployResult;
    });

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
        uniswapFactoryAddress,
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
        const marginlyPoolDeploymentResult = await marginlyDeployer.getOrCreateMarginlyPool(
          marginlyFactoryDeployResult.contract,
          pool,
          tokenRepository
        );
        deployedMarginlyPools.push({
          id: pool.id,
          address: marginlyPoolDeploymentResult.address,
        });
        printDeployState(`Marginly Pool '${pool.id}'`, marginlyPoolDeploymentResult, logger);
      }
      return deployedMarginlyPools;
    });

    let marginlyKeeperAddress = getMarginlyKeeperAddress(stateStore);
    if (!marginlyKeeperAddress) {
      let aavePoolAddressesProviderAddress: EthAddress;

      if (config.marginlyKeeper.aavePoolAddressesProvider.allowCreateMock) {
        const deployedMockAavePool = await using(logger.beginScope('Deploy MockAavePool'), async () => {
          const deploymentResult = await marginlyDeployer.getOrCreateMockAavePool();
          printDeployState(`Mock AAVE pool`, deploymentResult, logger);
          return deploymentResult;
        });

        const deployedMockAavePoolAddressesProvider = await using(
          logger.beginScope('Deploy MockAavePoolAddressesProvider'),
          async () => {
            const deploymentResult = await marginlyDeployer.getOrCreateMockAavePoolAddressesProvider(
              EthAddress.parse(deployedMockAavePool.address)
            );
            printDeployState(`MockAavePoolAddressesProvider`, deploymentResult, logger);
            return deploymentResult;
          }
        );
        aavePoolAddressesProviderAddress = EthAddress.parse(deployedMockAavePoolAddressesProvider.address);
      } else if (config.marginlyKeeper.aavePoolAddressesProvider.address) {
        const aavePoolAddressesProvider = marginlyDeployer.getAavePoolAddressesProvider(
          config.marginlyKeeper.aavePoolAddressesProvider.address
        );

        aavePoolAddressesProviderAddress = EthAddress.parse(aavePoolAddressesProvider.address);
      }

      const deployedMarginlyKeeper = await using(logger.beginScope('Deploy MarginlyKeeper'), async () => {
        const deploymentResult = await marginlyDeployer.deployMarginlyKeeper(aavePoolAddressesProviderAddress);
        printDeployState(`Marginly keeper`, deploymentResult, logger);
        return deploymentResult;
      });

      marginlyKeeperAddress = deployedMarginlyKeeper.address;
    }

    return {
      marginlyPools: deployedMarginlyPools,
      marginlyKeeper: { address: marginlyKeeperAddress },
    };
  } finally {
    const balanceAfter = await signer.getBalance();
    const ethSpent = balanceBefore.sub(balanceAfter);

    logger.log(`ETH spent: ${ethers.utils.formatEther(ethSpent)}`);
  }
}
