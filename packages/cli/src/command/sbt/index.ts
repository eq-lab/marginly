import {
  createSystemContext,
  getCommanderFlagForm,
  getCommanderForm,
  readEthSignerFromContext,
  readFlag,
  readParameter,
  registerEthSignerParameters,
  SystemContext,
} from '@marginly/cli-common';
import * as ethers from 'ethers';
import { log } from '@marginly/common';
import * as ganache from 'ganache';
import { Command } from 'commander';
import { assertSbtBalances, mintSbt, SbtBalance } from '@marginly/sbt';
import { sbtContractName, SbtDeployment } from '@marginly/sbt';
import * as fs from 'fs';
import path from 'path';

export const ethNodeUriParameter = {
  name: ['eth', 'node', 'uri'],
  description: 'Eth Node URI',
};

export const dryRunParameter = {
  name: ['dry', 'run'],
  description: 'Run command on chain fork',
};

export const dryRunOptsParameter = {
  name: ['dry', 'run', 'opts'],
  description: "Dry run options. You can specify 'fund' to fund deployer account",
};

export const deploymentFileParameter = {
  name: ['deployment', 'file'],
  description: 'Path to custom deployment file',
};

export const contractRootParameter = {
  name: ['contract', 'root'],
  description: 'Compiled contracts root directory',
};

interface ReadWriteSbt {
  signer: ethers.Signer;
  ethNodeUri: string;
  deployment: SbtDeployment;
  contractRoot: string;
  dryRun: boolean;
}

export function createContractReader(contractRoot: string) {
  return (name: string) => {
    return JSON.parse(fs.readFileSync(`${contractRoot}${path.sep}${name}.sol${path.sep}${name}.json`, 'utf-8'));
  };
}

export function createSbtContract(signer: ethers.Signer, contractRoot: string, contractAddress: string) {
  const readContract = createContractReader(contractRoot);
  const sbtContractDescription = readContract(sbtContractName);
  const sbtContractFactory = new ethers.ContractFactory(sbtContractDescription.abi, sbtContractDescription.bytecode);
  return sbtContractFactory.attach(contractAddress).connect(signer);
}

export const readReadWriteSbtFromContext = async (systemContext: SystemContext): Promise<ReadWriteSbt> => {
  const ethNodeUri = await readParameter(ethNodeUriParameter, systemContext);
  if (ethNodeUri === undefined) {
    throw new Error(`${getCommanderForm(ethNodeUriParameter)} is required`);
  }

  const dryRun = readFlag(dryRunParameter, systemContext);
  let provider;
  if (!dryRun) {
    provider = new ethers.providers.JsonRpcProvider(ethNodeUri);
  } else {
    log(`Dry run command on fork`);
    const options = { logging: { quiet: true }, fork: { url: ethNodeUri } };
    provider = new ethers.providers.Web3Provider(
      ganache.provider(options) as unknown as ethers.providers.ExternalProvider
    );
    const blockNumber = await provider.getBlockNumber();
    log(`Fork block number: ${blockNumber}`);
  }
  const signer = (await readEthSignerFromContext(systemContext)).connect(provider);

  const deploymentFile = await readParameter(deploymentFileParameter, systemContext);
  if (deploymentFile === undefined) {
    throw new Error(`${getCommanderForm(deploymentFileParameter)} is required`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8')) as SbtDeployment;

  const contractRoot = await readParameter(contractRootParameter, systemContext);
  if (contractRoot === undefined) {
    throw new Error(`${getCommanderForm(contractRootParameter)} is required`);
  }

  return {
    signer,
    ethNodeUri,
    deployment,
    contractRoot,
    dryRun,
  };
};

const readSbt = async (command: Command): Promise<ReadWriteSbt> => {
  const ethBridgeCommand = command?.parent;

  if (!ethBridgeCommand) {
    throw new Error('Erc-20 command is not found');
  }

  const systemContext = createSystemContext(ethBridgeCommand);

  return await readReadWriteSbtFromContext(systemContext);
};

const mintCommand = new Command('mint').requiredOption('--amounts <amounts>', '').action(
  async (
    {
      amounts,
    }: {
      amounts: string;
    },
    command: Command
  ) => {
    const { deployment, contractRoot, signer } = await readSbt(command);
    const sbtContract = createSbtContract(signer, contractRoot, deployment.address);
    const balances = JSON.parse(amounts) as SbtBalance[];
    assertSbtBalances(balances, deployment.tokens);
    await mintSbt(signer, sbtContract, balances);
  }
);

export const registerReadOnlyEthParameters = (command: Command): Command => {
  return command.option(getCommanderForm(ethNodeUriParameter), ethNodeUriParameter.description);
};

export const registerReadWriteEthParameters = (command: Command): Command => {
  return registerEthSignerParameters(registerReadOnlyEthParameters(command))
    .option(getCommanderFlagForm(dryRunParameter), dryRunParameter.description)
    .option(getCommanderForm(dryRunOptsParameter), dryRunOptsParameter.description)
    .option(getCommanderForm(deploymentFileParameter), deploymentFileParameter.description)
    .option(getCommanderForm(contractRootParameter), contractRootParameter.description);
};

export const sbtCommand = registerReadWriteEthParameters(new Command('sbt')).addCommand(mintCommand);
