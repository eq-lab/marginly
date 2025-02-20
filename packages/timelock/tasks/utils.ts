import { ConfigurableTaskDefinition, HardhatRuntimeEnvironment } from 'hardhat/types';
import * as fs from 'fs';
import path from 'path';
import prompts from 'prompts';
import { ethers } from 'ethers';
import { task } from 'hardhat/config';

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

export interface SignerArgs {
  privateKey?: string;
  keystore?: string;
  keystorePassword?: string;
}

/**
 * Create a task with signer arguments
 * @param name the name of the task
 * @param description the description of the task
 * @returns a task with signer arguments
 */
export function taskWithSigner(name: string, description?: string): ConfigurableTaskDefinition {
  return task(name, description)
    .addOptionalParam<string>('privateKey', 'Private key of contracts creator')
    .addOptionalParam<string>('keystore', 'Keystore file path')
    .addOptionalParam<string>('keystorePassword', 'Keystore file password');
}

/**
 * Returns a signer object from given signer arguments.
 * If signer arguments contain a private key, it is used to create the signer.
 * If signer arguments contain a keystore file path, the keystore is decrypted
 * using the provided password and the wallet is created from it.
 * If no keystore password is provided, the user is prompted to enter it interactively.
 * If no private key or keystore is provided, the user is prompted to enter a private key interactively.
 * @param signerArgs signer arguments
 * @param provider optional provider to connect the wallet to
 * @returns a signer object
 */
export async function getSigner(signerArgs: SignerArgs, provider?: ethers.Provider | null): Promise<ethers.Wallet> {
  const readSensitiveData = async (label: string): Promise<string> => {
    const response = await prompts({
      type: 'invisible',
      name: 'result',
      message: label,
    });

    return response.result as string;
  };

  if (signerArgs.privateKey) {
    console.warn('\n!!! Using private key in plain text is not recommended\n');
    return new ethers.Wallet(signerArgs.privateKey);
  } else if (signerArgs.keystore) {
    let keystorePassword = '';
    if (signerArgs.keystorePassword) {
      console.warn('\n!!! Use interactive mode to enter keystore password\n');
      keystorePassword = signerArgs.keystorePassword;
    } else {
      keystorePassword = await readSensitiveData('Enter keystore password');
    }
    const jsonKeystore = fs.readFileSync(signerArgs.keystore, 'utf8');

    const wallet = ethers.Wallet.fromEncryptedJsonSync(jsonKeystore, keystorePassword) as ethers.Wallet;
    if (!wallet) {
      throw new Error('Could not create wallet from keystore');
    }

    return provider ? wallet.connect(provider) : wallet;
  } else {
    const privateKey = await readSensitiveData('Enter signer private key');
    return new ethers.Wallet(privateKey, provider);
  }
}
