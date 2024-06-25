import { Signer } from 'ethers';
import { EthOptions } from '../config';
import { createKeeperContractReader } from './contract-reader';
import { StateStore } from '../common';
import { Logger } from '../logger';
import { DeployResult } from '../common/interfaces';
import { BaseDeployer } from './BaseDeployer';

export class KeeperAlgebraDeployer extends BaseDeployer {
  private readonly readKeeperContract;

  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    super(signer, ethArgs, stateStore, logger);
    this.readKeeperContract = createKeeperContractReader();
  }

  public deployKeeper(): Promise<DeployResult> {
    return this.deploy('MarginlyKeeperAlgebra', [], 'marginlyKeeperAlgebra', this.readKeeperContract);
  }
}
