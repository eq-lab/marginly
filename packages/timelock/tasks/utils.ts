import { HardhatRuntimeEnvironment } from 'hardhat/types';
import * as fs from 'fs';
import path from 'path';

export async function saveDeploymentData(contractId: string, deploymentData: any, configDir: string): Promise<void> {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const filename = configDir + `/deployment-${contractId}-${year}-${month}-${day}.json`;
  const data = JSON.stringify(deploymentData, null, 2) + `\n`;
  const resolvedPath = path.resolve(__dirname, filename);
  fs.writeFileSync(resolvedPath, data, { flag: 'wx' });
  console.log(`\nDeployment data saved: ${resolvedPath}`);
}

export async function verifyContract(hre: HardhatRuntimeEnvironment, address: string, constructorArguments: any[]) {
  const isDryRun = hre.config.networks.hardhat.forking !== undefined;
  if (!isDryRun) {
    console.log(`Verify contract ${address} with constructor arguments: ${constructorArguments}`);
    await delay(12_000); //wait 12 seconds

    try {
      await hre.run('verify:verify', {
        address,
        constructorArguments,
      });
    } catch (e) {
      console.log(`Verify contract ${address} failed: ${e}`);
    }
  }
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}