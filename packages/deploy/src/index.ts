import * as ethers from 'ethers';
import { EthAddress } from '@marginly/common';
import { MarginlyDeployConfig } from './config';
import { Logger } from './logger';
import { getMarginlyKeeperAddress, MarginlyDeployment, StateStore, using } from './common';
import { MarginlyDeployer } from './deployer';
import { TokenRepository } from './token-repository';
import { StrictMarginlyDeployConfig } from './deployer/configs';
import { deploySwapPools } from './deploys/pool-registry-deploy';
import {
  deployAdapters,
  deployMarginlyFactory,
  deployMarginlyImpl,
  deployMarginlyPools,
  deployRouter,
} from './deploys/core-deploy';
import { deployAdminContract, deployKeeper } from './deploys/periphery-deploy';
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

    const uniswapFactoryAddress = await using(logger.beginScope('Process uniswap'), async () => {
      return deploySwapPools(config.uniswap, tokenRepository, marginlyDeployer);
    });

    const adapterDeployResults = await deployAdapters(
      config.marginlyAdapters,
      tokenRepository,
      marginlyDeployer
    );

    const marginlyRouterDeployResult = await deployRouter(marginlyDeployer, adapterDeployResults);

    const marginlyPoolImplDeployResult = await using(
      logger.beginScope('Deploy marginly pool implementation'),
      async () => {
        return deployMarginlyImpl(marginlyDeployer);
      }
    );

    const marginlyFactoryDeployResult = await using(logger.beginScope('Deploy marginly factory'), async () => {
      return deployMarginlyFactory(
        config.marginlyFactory,
        tokenRepository,
        marginlyDeployer,
        EthAddress.parse(marginlyPoolImplDeployResult.address),
        uniswapFactoryAddress,
        EthAddress.parse(marginlyRouterDeployResult.address)
      );
    });

    let deployedAdmin: DeployResult | undefined;

    if (config.deployAdmin) {
      deployedAdmin = await using(logger.beginScope('Deploy admin contract'), async () => {
        return deployAdminContract(
          marginlyDeployer,
          marginlyFactoryDeployResult,
          marginlyRouterDeployResult,
          adapterDeployResults
        );
      });   
    }

    const deployedMarginlyPools = await using(logger.beginScope('Create marginly pools'), async () => {
      return deployMarginlyPools(
        config.marginlyPools,
        tokenRepository,
        marginlyDeployer,
        marginlyFactoryDeployResult.contract,
        deployedAdmin ? deployedAdmin.contract : undefined
      );
    });

    let marginlyKeeperAddress = getMarginlyKeeperAddress(stateStore);
    if (marginlyKeeperAddress === undefined) {
      marginlyKeeperAddress = await deployKeeper(config.marginlyKeeper, marginlyDeployer);
    }

    return {
      marginlyPools: deployedMarginlyPools,
      marginlyKeeper: { address: marginlyKeeperAddress.toString() },
      adminContract: deployedAdmin ? { address: deployedAdmin.address.toString() } : undefined,
    };
  } finally {
    const balanceAfter = await signer.getBalance();
    const ethSpent = balanceBefore.sub(balanceAfter);

    logger.log(`ETH spent: ${ethers.utils.formatEther(ethSpent)}`);
  }
}
