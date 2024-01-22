import * as ethers from 'ethers';
import { EthAddress, RationalNumber } from '@marginly/common';
import { Dex, MarginlyDeployConfig } from './config';
import { priceToPriceFp27, priceToSqrtPriceX96, sortUniswapPoolTokens } from '@marginly/common/math';
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
  isMarginlyConfigSwapPoolRegistry,
  isMarginlyConfigUniswapGenuine,
  isMarginlyConfigUniswapMock,
  StrictMarginlyDeployConfig,
} from './deployer/configs';
import { Contract } from 'ethers';
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

          const priceFp27 = priceToPriceFp27(price, token0Decimals, token1Decimals);
          const sqrtPriceX96 = priceToSqrtPriceX96(price, token0Decimals, token1Decimals);

          const uniswapPoolContract = uniswapPoolDeploymentResult.contract;

          await uniswapPoolContract.setPrice(priceFp27, sqrtPriceX96);
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
      } else if (isMarginlyConfigSwapPoolRegistry(config.uniswap)) {
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

        return EthAddress.parse(swapPoolDeploymentResult.address);
      } else {
        throw new Error('Unknown Uniswap type');
      }
    });

    const adapterDeployResults: { dexId: ethers.BigNumber; adapter: EthAddress; contract: Contract }[] = [];
    const marginlyRouterDeployResult = await using(logger.beginScope('Deploy marginly router'), async () => {
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
            adapter: EthAddress.parse(marginlyAdapterDeployResult.address),
            contract: marginlyAdapterDeployResult.contract,
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

    /*TODO: think of deploy order 
    const marginlyPoolAdminDeployResult = await using(logger.beginScope('Deploy marginly pool admin'), async () => {
      const marginlyPoolAdminDeployResult = await marginlyDeployer.deployMarginlyPoolAdmin(
        EthAddress.parse(marginlyFactoryDeployResult.address)
      );
      printDeployState('Marginly pool admin', marginlyPoolAdminDeployResult, logger);

      const marginlyFactoryOwner = ((await marginlyFactoryDeployResult.contract.owner()) as string).toLowerCase();
      if (marginlyFactoryOwner === (await signer.getAddress()).toLowerCase()) {
        logger.log('Transfer MarginlyFactory ownership to MarginlyPoolAdmin contract');
        await marginlyFactoryDeployResult.contract.setOwner(marginlyPoolAdminDeployResult.address);
      } else if (marginlyFactoryOwner === marginlyPoolAdminDeployResult.address.toLowerCase()) {
        logger.log('MarginlyFactory ownership already set');
      } else {
        throw new Error('MarginlyFactory has unknown owner');
      }

      const marginlyRouterOwner = ((await marginlyRouterDeployResult.contract.owner()) as string).toLowerCase();
      if (marginlyRouterOwner === (await signer.getAddress()).toLowerCase()) {
        logger.log('Transfer MarginlyRouter ownership to MarginlyPoolAdmin contract');
        await marginlyRouterDeployResult.contract.transferOwnership(marginlyPoolAdminDeployResult.address);
      } else if (marginlyRouterOwner === marginlyPoolAdminDeployResult.address.toLowerCase()) {
        logger.log('MarginlyRouter ownership already set');
      } else {
        throw new Error('MarginlyRouter has unknown owner');
      }

      for (const adapter of adapterDeployResults) {
        const adapterOwner = ((await adapter.contract.owner()) as string).toLowerCase();
        if (adapterOwner === (await signer.getAddress()).toLowerCase()) {
          logger.log(`Transfer router adapter with DexId ${adapter.dexId} ownership to MarginlyPoolAdmin contract`);
          await adapter.contract.transferOwnership(marginlyPoolAdminDeployResult.address);
        } else if (adapterOwner === marginlyPoolAdminDeployResult.address.toLowerCase()) {
          logger.log(`Ownership for router adapter with DexId ${adapter.dexId} already set`);
        } else {
          throw new Error('Router adapter has unknown owner');
        }
      }
      return marginlyPoolAdminDeployResult;
    });
    */

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

    const deployedMarginlyKeeperUniswapV3 = await using(
      logger.beginScope('Deploy MarginlyKeeperUniswapV3'),
      async () => {
        const deploymentResult = await marginlyDeployer.deployMarginlyKeeperUniswapV3();
        printDeployState(`MarginlyKeeperUniswapV3`, deploymentResult, logger);
        return deploymentResult;
      }
    );

    return {
      marginlyPools: deployedMarginlyPools,
      marginlyKeeper: { address: marginlyKeeperAddress },
      marginlyKeeperUniswapV3: { address: deployedMarginlyKeeperUniswapV3.address },
    };
  } finally {
    const balanceAfter = await signer.getBalance();
    const ethSpent = balanceBefore.sub(balanceAfter);

    logger.log(`ETH spent: ${ethers.utils.formatEther(ethSpent)}`);
  }
}
