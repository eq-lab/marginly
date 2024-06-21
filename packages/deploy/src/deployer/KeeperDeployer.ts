import { Signer, ethers } from 'ethers';
import { EthOptions } from '../config';
import {
  createAaveContractReader,
  createMarginlyContractReader,
  createMarginlyMockContractReader,
} from './contract-reader';
import { StateStore } from '../common';
import { Logger } from '../logger';
import { EthAddress } from '@marginly/common';
import { DeployResult, LimitedDeployResult } from '../common/interfaces';
import { BaseDeployer } from './BaseDeployer';

export class KeeperDeployer extends BaseDeployer {
  private readonly readMarginlyContract;
  private readonly readAaveContract;
  private readonly readMarginlyMockContract;

  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    super(signer, ethArgs, stateStore, logger);
    this.readMarginlyContract = createMarginlyContractReader();
    this.readAaveContract = createAaveContractReader();
    this.readMarginlyMockContract = createMarginlyMockContractReader();
  }

  public getMarginlyKeeperAddress(): EthAddress | undefined {
    const deployState = this.stateStore.getById('marginlyKeeper');
    return deployState ? EthAddress.parse(deployState.address) : undefined;
  }

  public async getOrCreateMockAavePoolAddressesProvider(aavePoolAddress: EthAddress): Promise<LimitedDeployResult> {
    const stateFileId = `mockAavePoolAddressesProvider`;
    const mockAavePoolAddressesProviderContractDescription = this.readMarginlyMockContract(
      'MockAavePoolAddressesProvider'
    );

    const stateFromFile = this.stateStore.getById(stateFileId);
    if (stateFromFile !== undefined) {
      this.logger.log(`Import MockAavePool from state file`);

      const mockAavePoolAddressesProviderContract = new ethers.Contract(
        stateFromFile.address,
        mockAavePoolAddressesProviderContractDescription.abi,
        this.provider
      );

      return {
        address: stateFromFile.address,
        txHash: stateFromFile.txHash,
        contract: mockAavePoolAddressesProviderContract,
      };
    }

    return await this.deploy(
      'MockAavePoolAddressesProvider',
      [aavePoolAddress.toString()],
      'mockAavePoolAddressesProvider',
      this.readMarginlyMockContract
    );
  }

  public getAavePoolAddressesProvider(address: EthAddress): ethers.Contract {
    const aavePoolAddressesProviderContractDescription = this.readAaveContract('IPoolAddressesProvider');
    return new ethers.Contract(address.toString(), aavePoolAddressesProviderContractDescription.abi, this.signer);
  }

  public deployMarginlyKeeper(aavePoolAddressesProvider: EthAddress): Promise<DeployResult> {
    return this.deploy(
      'MarginlyKeeper',
      [aavePoolAddressesProvider.toString()],
      'marginlyKeeper',
      this.readMarginlyContract
    );
  }

  public async getOrCreateMockAavePool(): Promise<LimitedDeployResult> {
    const stateFileId = `mockAavePool`;
    const mockAavePoolContractDescription = this.readMarginlyMockContract('MockAavePool');

    const stateFromFile = this.stateStore.getById(stateFileId);
    if (stateFromFile !== undefined) {
      this.logger.log(`Import MockAavePool from state file`);

      const mockAavePoolContract = new ethers.Contract(
        stateFromFile.address,
        mockAavePoolContractDescription.abi,
        this.provider
      );

      return {
        address: stateFromFile.address,
        txHash: stateFromFile.txHash,
        contract: mockAavePoolContract,
      };
    }

    return await this.deploy('MockAavePool', [], 'mockAavePool', this.readMarginlyMockContract);
  }
}
