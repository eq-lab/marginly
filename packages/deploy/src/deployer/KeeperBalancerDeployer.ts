import { Signer } from 'ethers';
import { EthOptions } from '../config';
import { createMarginlyContractReader } from './contract-reader';
import { StateStore } from '../common';
import { Logger } from '../logger';
import { DeployResult } from '../common/interfaces';
import { BaseDeployer } from './BaseDeployer';
import { EthAddress } from '@marginly/common';

export class KeeperBalancerDeployer extends BaseDeployer {
  private readonly readMarginlyContract;

  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    super(signer, ethArgs, stateStore, logger);
    this.readMarginlyContract = createMarginlyContractReader();
  }

  public deployKeeper(balancerVault: EthAddress): Promise<DeployResult> {
    return this.deploy(
      'MarginlyKeeperBalancer',
      [balancerVault.toString()],
      'marginlyKeeperBalancer',
      this.readMarginlyContract
    );
  }
}
