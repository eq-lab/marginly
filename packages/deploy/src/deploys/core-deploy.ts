import { EthAddress } from '@marginly/common';
import { Contract, ethers } from 'ethers';
import { MarginlyDeployer } from '../deployer';
import { MarginlyDeploymentMarginlyPool, printDeployState, using } from '../common';
import { TokenRepository } from '../token-repository';
import {
  MarginlyConfigAdapter,
  MarginlyConfigMarginlyPool,
  MarginlyConfigMarginlyRouter,
  MarginlyFactoryConfig,
} from '../deployer/configs';
import { AdapterDeployResult, DeployResult } from '../common/interfaces';

export async function deployMarginlyImpl(marginlyDeployer: MarginlyDeployer): Promise<DeployResult> {
  return using(marginlyDeployer.logger.beginScope('Deploy marginly pool implementation'), async () => {
    const marginlyPoolImplDeployResult = await marginlyDeployer.deployMarginlyPoolImplementation();
    printDeployState('Marginly pool implementation', marginlyPoolImplDeployResult, marginlyDeployer.logger);

    return marginlyPoolImplDeployResult;
  });
}

export async function deployMarginlyFactory(
  config: MarginlyFactoryConfig,
  tokenRepository: TokenRepository,
  marginlyDeployer: MarginlyDeployer,
  marginlyImplementation: EthAddress,
  poolRegistry: EthAddress,
  router: EthAddress
): Promise<DeployResult> {
  return using(marginlyDeployer.logger.beginScope('Deploy marginly factory'), async () => {
    const marginlyFactoryDeployResult = await marginlyDeployer.deployMarginlyFactory(
      marginlyImplementation,
      poolRegistry,
      router,
      config.feeHolder,
      config.weth9Token,
      tokenRepository,
      config.techPositionOwner
    );
    printDeployState('Marginly Factory', marginlyFactoryDeployResult, marginlyDeployer.logger);

    return marginlyFactoryDeployResult;
  });
}

export async function deployMarginlyPools(
  marginlyPools: MarginlyConfigMarginlyPool[],
  tokenRepository: TokenRepository,
  marginlyDeployer: MarginlyDeployer,
  marginlyFactory: Contract
): Promise<MarginlyDeploymentMarginlyPool[]> {
  return using(marginlyDeployer.logger.beginScope('Create marginly pools'), async () => {
    const deployedMarginlyPools: MarginlyDeploymentMarginlyPool[] = [];
    for (const pool of marginlyPools) {
      const marginlyPoolDeploymentResult = await marginlyDeployer.getOrCreateMarginlyPool(
        marginlyFactory,
        pool,
        tokenRepository
      );
      deployedMarginlyPools.push({
        id: pool.id,
        address: marginlyPoolDeploymentResult.address,
      });
      printDeployState(`Marginly Pool '${pool.id}'`, marginlyPoolDeploymentResult, marginlyDeployer.logger);
    }
    return deployedMarginlyPools;
  });
}

export async function deployRouter(
  marginlyDeployer: MarginlyDeployer,
  adapterDeployResults: AdapterDeployResult[]
): Promise<DeployResult> {
  const marginlyRouterDeployResult = await marginlyDeployer.deployMarginlyRouter(adapterDeployResults);
  printDeployState('Marginly router', marginlyRouterDeployResult, marginlyDeployer.logger);

  return marginlyRouterDeployResult;
}

export async function deployAdapters(
  adapters: MarginlyConfigAdapter[],
  tokenRepository: TokenRepository,
  marginlyDeployer: MarginlyDeployer
): Promise<AdapterDeployResult[]> {
  const adapterDeployResults: AdapterDeployResult[] = [];
  for (const adapter of adapters) {
    await using(marginlyDeployer.logger.beginScope('Deploy marginly adapter'), async () => {
      const marginlyAdapterDeployResult = await marginlyDeployer.deployMarginlyAdapter(
        tokenRepository,
        adapter.dexId,
        adapter.name,
        adapter.marginlyAdapterParams,
        adapter.balancerVault
      );
      printDeployState('Marginly adapter', marginlyAdapterDeployResult, marginlyDeployer.logger);
      adapterDeployResults.push({
        dexId: adapter.dexId,
        address: marginlyAdapterDeployResult.address,
        contract: marginlyAdapterDeployResult.contract,
      });
    });
  }
  return adapterDeployResults;
}
