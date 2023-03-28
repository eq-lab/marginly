import fs from 'fs';
import * as ethers from 'ethers';
import { Signer } from 'ethers';
import * as path from 'path';
import {
  askParameter,
  getCommanderForm,
  readParameter,
  readParameterInteractive,
  SystemContext,
} from '../system-context';
import { LedgerSigner } from '@ethersproject/hardware-wallets';
import { Command } from 'commander';
import { BigNumber } from '@ethersproject/bignumber';

export type SignerOrProvider = ethers.Signer | ethers.providers.Provider;

export interface ContractDescription {
  abi: ethers.utils.Interface;
  bytecode: string;
}

export type ContractReader = (name: string) => ContractDescription;

export const createContractReader =
  (contractRoot: string) =>
  (name: string): ContractDescription => {
    return JSON.parse(fs.readFileSync(`${contractRoot}${path.sep}${name}.json`, 'utf-8'));
  };

export const log = (message: string): void => {
  console.error(message);
};

export const sectionLog = (message: string): void => {
  console.error(`\n${message}`);
};

export const subsectionLog = (message: string): void => {
  console.error(`  ${message}`);
};

export const ethKeyTypeParameter = {
  name: ['eth', 'key', 'type'],
  description: 'Type of the eth private key. Can be one of: raw, json, ledger',
  default: 'raw',
};
export const ethKeyParameter = {
  name: ['eth', 'key'],
  description: 'Relay private key',
};
export const ethKeyFileParameter = {
  name: ['eth', 'key', 'file'],
  description: 'Relay private key file',
};
export const ethKeyPasswordParameter = {
  name: ['eth', 'key', 'password'],
  description: "Password for the provided eth key if it's type requires it",
};

export const registerEthSignerParameters = (command: Command): Command => {
  return command
    .option(getCommanderForm(ethKeyTypeParameter), ethKeyPasswordParameter.description)
    .option(getCommanderForm(ethKeyParameter), ethKeyParameter.description)
    .option(getCommanderForm(ethKeyFileParameter), ethKeyFileParameter.description)
    .option(getCommanderForm(ethKeyPasswordParameter), ethKeyPasswordParameter.description);
};

export const readEthSignerFromContext = async (systemContext: SystemContext): Promise<Signer> => {
  const ethKeyType = (await readParameter(ethKeyTypeParameter, systemContext)) ?? 'raw';

  if (ethKeyType === 'raw') {
    let ethKey = readParameter(ethKeyParameter, systemContext);
    const ethKeyFile = readParameter(ethKeyFileParameter, systemContext);

    if (ethKey !== undefined && ethKeyFile !== undefined) {
      throw new Error(
        `${getCommanderForm(ethKeyParameter)} and ${getCommanderForm(ethKeyFileParameter)} can not be both specified`
      );
    } else if (ethKey !== undefined) {
      // we are just fine
    } else if (ethKeyFile !== undefined) {
      ethKey = fs.readFileSync(ethKeyFile, 'utf-8').trim();
    } else {
      // Neither ethKey nor ethKeyFile is specified
      ethKey = await askParameter(ethKeyParameter, systemContext);
    }

    return new ethers.Wallet(ethKey);
  } else if (ethKeyType === 'json') {
    let ethKey = readParameter(ethKeyParameter, systemContext);
    const ethKeyFile = readParameter(ethKeyFileParameter, systemContext);

    if (ethKey !== undefined && ethKeyFile !== undefined) {
      throw new Error(
        `${getCommanderForm(ethKeyParameter)} and ${getCommanderForm(ethKeyFileParameter)} can not be both specified`
      );
    } else if (ethKey === undefined && ethKeyFile === undefined) {
      throw new Error(
        `Either ${getCommanderForm(ethKeyParameter)} or ${getCommanderForm(ethKeyFileParameter)} must be specified`
      );
    } else if (ethKey !== undefined) {
      // we are just fine
    } else if (ethKeyFile !== undefined) {
      ethKey = fs.readFileSync(ethKeyFile, 'utf-8');
    } else {
      throw new Error('Should never happen');
    }

    const ethKeyPassword = await readParameterInteractive(ethKeyPasswordParameter, systemContext);
    return ethers.Wallet.fromEncryptedJson(ethKey, ethKeyPassword);
  } else if (ethKeyType === 'ledger') {
    const ethKey = readParameter(ethKeyParameter, systemContext);
    if (ethKey === undefined) {
      throw new Error(`${getCommanderForm(ethKeyParameter)} is required`);
    }
    const signer = new LedgerSigner(undefined, 'hid', ethKey);
    log(`Address for the specified derivation path is ${await signer.getAddress()}`);
    return signer;
  } else {
    throw new Error(`Unknown ${getCommanderForm(ethKeyTypeParameter)} value`);
  }
};

export function formatBalance(amount: BigNumber, decimals: number, assetSymbol: string): string {
  return `${amount} (${ethers.utils.formatUnits(amount, decimals)} ${assetSymbol.toUpperCase()})`;
}

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const waitForTx = async (provider: ethers.providers.Provider, hash: string) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) {
      await sleep(3000);
    } else {
      if (!receipt.status) {
        throw new Error('Transaction failed');
      }
      break;
    }
  }
};
