import fs from 'fs';
import { Command } from 'commander';
import {
  askParameter,
  getCommanderForm,
  readParameter,
  readParameterInteractive,
  SystemContext,
} from './system-context';
import { Wallet } from 'zksync-web3';

export const ethKeyTypeParameter = {
  name: ['eth', 'key', 'type'],
  description: 'Type of the eth private key. Can be one of: raw, json',
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

export const registerZkWalletParameters = (command: Command): Command => {
  return command
    .option(getCommanderForm(ethKeyTypeParameter), ethKeyPasswordParameter.description)
    .option(getCommanderForm(ethKeyParameter), ethKeyParameter.description)
    .option(getCommanderForm(ethKeyFileParameter), ethKeyFileParameter.description)
    .option(getCommanderForm(ethKeyPasswordParameter), ethKeyPasswordParameter.description);
};

export const readZkWalletFromContext = async (systemContext: SystemContext): Promise<Wallet> => {
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

    return new Wallet(ethKey);
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
    return Wallet.fromEncryptedJson(ethKey, ethKeyPassword);
  } else {
    throw new Error(`Unknown ${getCommanderForm(ethKeyTypeParameter)} value`);
  }
};
