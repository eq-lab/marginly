import { Signer } from 'ethers';
import { EthOptions } from '../config';
import { createKeeperContractReader } from './contract-reader';
import { StateStore } from '../common';
import { Logger } from '../logger';
import { DeployResult } from '../common/interfaces';
import { BaseDeployer } from './BaseDeployer';

export class KeeperUniswapV3Deployer extends BaseDeployer {
  private readonly readKeeperContract;

  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    super(signer, ethArgs, stateStore, logger);
    this.readKeeperContract = createKeeperContractReader();
  }

  public deployKeeper(): Promise<DeployResult> {
    return this.deploy('MarginlyKeeperUniswapV3', [], 'marginlyKeeperUniswapV3', this.readKeeperContract);
  }
}
