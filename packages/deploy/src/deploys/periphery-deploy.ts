import { EthAddress } from '@marginly/common';
import { MarginlyDeployer } from '../deployer';
import { getMarginlyKeeperAddress, printDeployState, using } from '../common';
import { AdapterDeployResult, DeployResult } from '../common/interfaces';
import { MarginlyConfigMarginlyKeeper } from '../deployer/configs';

export async function deployKeeper(
  config: MarginlyConfigMarginlyKeeper,
  marginlyDeployer: MarginlyDeployer
): Promise<EthAddress> {
  const logger = marginlyDeployer.logger;
  let aavePoolAddressesProviderAddress: EthAddress;

  if (config.aavePoolAddressesProvider.allowCreateMock) {
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
  } else if (config.aavePoolAddressesProvider.address) {
    const aavePoolAddressesProvider = marginlyDeployer.getAavePoolAddressesProvider(
      config.aavePoolAddressesProvider.address
    );

    aavePoolAddressesProviderAddress = EthAddress.parse(aavePoolAddressesProvider.address);
  }

  const deployedMarginlyKeeper = await using(logger.beginScope('Deploy MarginlyKeeper'), async () => {
    const deploymentResult = await marginlyDeployer.deployMarginlyKeeper(aavePoolAddressesProviderAddress);
    printDeployState(`Marginly keeper`, deploymentResult, logger);
    return deploymentResult;
  });

  return EthAddress.parse(deployedMarginlyKeeper.address);
}

export async function deployAdminContract(
  marginlyDeployer: MarginlyDeployer,
  marginlyFactoryDeployResult: DeployResult,
  routerDeployResult: DeployResult,
  adapterDeployResults: AdapterDeployResult[]
): Promise<DeployResult> {
  const logger = marginlyDeployer.logger;
  const marginlyPoolAdminDeployResult = await using(logger.beginScope('Deploy marginly pool admin'), async () => {
    const marginlyPoolAdminDeployResult = await marginlyDeployer.deployMarginlyPoolAdmin(
      EthAddress.parse(marginlyFactoryDeployResult.address)
    );
    printDeployState('Marginly pool admin', marginlyPoolAdminDeployResult, logger);

    const marginlyFactoryOwner = ((await marginlyFactoryDeployResult.contract.owner()) as string).toLowerCase();
    if (marginlyFactoryOwner === (await marginlyDeployer.signer.getAddress()).toLowerCase()) {
      logger.log('Transfer MarginlyFactory ownership to MarginlyPoolAdmin contract');
      await(await marginlyFactoryDeployResult.contract.transferOwnership(marginlyPoolAdminDeployResult.address)).wait();
      await(await marginlyPoolAdminDeployResult.contract.acceptMarginlyFactoryOwnership()).wait();
    } else if (marginlyFactoryOwner === marginlyPoolAdminDeployResult.address.toLowerCase()) {
      logger.log('MarginlyFactory ownership already set');
    } else {
      throw new Error('MarginlyFactory has unknown owner');
    }

    const marginlyRouterOwner = ((await routerDeployResult.contract.owner()) as string).toLowerCase();
    if (marginlyRouterOwner === (await marginlyDeployer.signer.getAddress()).toLowerCase()) {
      logger.log('Transfer MarginlyRouter ownership to MarginlyPoolAdmin contract');
      await(await routerDeployResult.contract.transferOwnership(marginlyPoolAdminDeployResult.address)).wait();
      await(await marginlyPoolAdminDeployResult.contract.acceptMarginlyRouterOwnership()).wait();
    } else if (marginlyRouterOwner === marginlyPoolAdminDeployResult.address.toLowerCase()) {
      logger.log('MarginlyRouter ownership already set');
    } else {
      throw new Error('MarginlyRouter has unknown owner');
    }

    for (const adapter of adapterDeployResults) {
      const adapterOwner = ((await adapter.contract.owner()) as string).toLowerCase();
      if (adapterOwner === (await marginlyDeployer.signer.getAddress()).toLowerCase()) {
        logger.log(`Transfer router adapter with DexId ${adapter.dexId} ownership to MarginlyPoolAdmin contract`);
        await(await adapter.contract.transferOwnership(marginlyPoolAdminDeployResult.address)).wait();
        await(await marginlyPoolAdminDeployResult.contract.acceptRouterAdapterOwnership(0)).wait();
      } else if (adapterOwner === marginlyPoolAdminDeployResult.address.toLowerCase()) {
        logger.log(`Ownership for router adapter with DexId ${adapter.dexId} already set`);
      } else {
        throw new Error('Router adapter has unknown owner');
      }
    }
    return marginlyPoolAdminDeployResult;
  });
  return marginlyPoolAdminDeployResult;
}
