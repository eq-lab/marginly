import { BigNumber, Signer, ethers } from 'ethers';
import { EthOptions } from '../config';
import { ContractDescription, RationalNumber } from '@marginly/common';
import { StateStore } from '../common';
import { Logger } from '../logger';
import { DeployResult } from '../common/interfaces';

export abstract class BaseDeployer {
  protected readonly deploy;
  protected readonly signer;
  protected readonly ethArgs;
  protected readonly provider;
  protected readonly stateStore;
  protected readonly logger;

  protected constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    this.deploy = deployTemplate(signer, ethArgs, stateStore, logger);
    this.ethArgs = ethArgs;
    this.signer = signer;

    if (signer.provider === undefined) {
      throw new Error('Provider is required');
    }
    this.provider = signer.provider;
    this.stateStore = stateStore;
    this.logger = logger;
  }

  //TODO: BaseDeployer not a correct place for this utils method
  public toUniswapFee(fee: RationalNumber): BigNumber {
    const uniswapFeeMultiplier = BigNumber.from('1000000');
    return fee.nom.mul(uniswapFeeMultiplier).div(fee.denom);
  }
}

const deployTemplate = (signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) => {
  return async (
    name: string,
    args: unknown[],
    id: string,
    contractReader: (name: string) => ContractDescription
  ): Promise<DeployResult> => {
    const contractDescription = contractReader(name);
    const factory = new ethers.ContractFactory(contractDescription.abi, contractDescription.bytecode, signer);

    const stateFromFile = stateStore.getById(id);
    if (stateFromFile) {
      logger.log(`Import ${name} contract from state file`);
      const contract = factory.attach(stateFromFile.address);
      return {
        address: stateFromFile.address,
        txHash: stateFromFile.txHash,
        factory: factory,
        contract: contract,
      };
    }

    const contract = await factory.deploy(...args, ethArgs);
    await contract.deployed();
    const result = {
      address: contract.address,
      txHash: contract.deployTransaction.hash,
      factory,
      contract,
    };
    stateStore.setById(id, {
      address: contract.address,
      txHash: contract.deployTransaction.hash,
    });
    return result;
  };
};
