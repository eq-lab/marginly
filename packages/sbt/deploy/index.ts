import * as ethers from 'ethers';

interface SbtDeployConfig {}

export interface SbtDeployment {
  sbt: { address: string };
}

export async function deploySbt(
  signer: ethers.Signer,
  rawConfig: SbtDeployConfig
  // stateStore: StateStore,
  // logger: Logger
): Promise<SbtDeployment> {
  console.log('DEPLOY SBT!');
  return { sbt: { address: '0x' } };
}
