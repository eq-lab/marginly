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
  MarginlyRouterConstructorParam,
  StrictMarginlyDeployConfig,
} from './deployer/configs';

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

    const routerPools: MarginlyRouterConstructorParam[] = [];

    const uniswapFactoryAddress = await using(logger.beginScope('Process uniswap'), async () => {
      if (isMarginlyConfigUniswapGenuine(config.uniswap)) {
        const uniswapConfig = config.uniswap;
        await using(logger.beginScope('Create uniswap pools'), async () => {
          for (const pool of uniswapConfig.pools) {
            routerPools.push({
              dex: Dex.UniswapV3,
              token0Address: tokenRepository.getTokenInfo(pool.tokenA.id).address.toString(),
              token1Address: tokenRepository.getTokenInfo(pool.tokenB.id).address.toString(),
              poolAddress: pool.assertAddress!.toString(),
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
        for (const pool of uniswapConfig.pools) {
          const uniswapPoolDeploymentResult = await marginlyDeployer.deployUniswapPoolMock(
            uniswapConfig.oracle,
            pool,
            tokenRepository
          );
          routerPools.push({
            dex: Dex.UniswapV3,
            token0Address: tokenRepository.getTokenInfo(pool.tokenA.id).address.toString(),
            token1Address: tokenRepository.getTokenInfo(pool.tokenB.id).address.toString(),
            poolAddress: uniswapPoolDeploymentResult.address,
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

    for (const pool of config.marginlyRouter.pools) {
      // const token0Address = tokenRepository.getTokenInfo(pool.token0Address.id).address.toString();
      // const token1Address = tokenRepository.getTokenInfo(pool.token1.id).address.toString();

      routerPools.push(pool);
    }
    const marginlyRouterDeployResult = await marginlyDeployer.deployMarginlyRouter(routerPools);

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
