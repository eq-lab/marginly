import { Command } from 'commander';
import { log } from '@marginly/common';
import {
  createSystemContext,
  getCommanderFlagForm,
  getCommanderForm,
  Parameter,
  readFlag,
  readParameter,
  SystemContext,
  readEthSignerFromContext,
  registerEthSignerParameters,
} from '@marginly/cli-common';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as ethers from 'ethers';
import * as ganache from 'ganache';
import * as os from 'os';
import * as path from 'path';
import {
  Logger,
  SimpleLogger,
  deployMarginly,
  mergeMarginlyDeployments,
  MarginlyDeployment,
  StateStore,
  BaseState,
  DeployState,
  DeployConfig,
} from '@marginly/deploy';

const nodeUriParameter = {
  name: ['eth', 'node', 'uri'],
  description: 'Eth Node URI',
};

export const dryRunParameter = {
  name: ['dry', 'run'],
  description: 'Run command on chain fork',
};

export const dryRunOptsParameter = {
  name: ['dry', 'run', 'opts'],
  description: 'Dry run options. You can specify \'fund\' to fund deployer account',
};

const readEthDeploy = async (command: Command, config: DeployConfig) => {
  const ethDeployCommand = command?.parent;

  if (!ethDeployCommand) {
    throw new Error('Eth Deploy command is not found');
  }

  const systemContext = createSystemContext(ethDeployCommand, config.systemContextDefaults);

  return await readReadWriteEthFromContext(systemContext);
};

function getStateFileName(deployDir: string, statesDirName: string, stateMode: StateMode): string {
  const dirName = path.join(deployDir, statesDirName);

  if (isNewStateMode(stateMode)) {
    if (stateMode.file === undefined) {
      const fileName = path.join(statesDirName, generateStateFileName(dirName));
      log(`Using new generated state file '${fileName}'`);
      return fileName;
    } else {
      const fullFileName = path.join(deployDir, stateMode.file);
      if (fs.existsSync(fullFileName)) {
        throw new Error(`File '${stateMode.file}' already exists`);
      }
      if (path.extname(fullFileName) !== '.json') {
        throw new Error('State file must have json extension');
      }
      log(`Using new specified state file '${stateMode.file}'`);
      return stateMode.file;
    }
  } else if (isLatestStateMode(stateMode)) {
    const fileName = path.join(statesDirName, getLatestStateFileName(dirName));
    log(`Using latest state file '${fileName}'`);
    return fileName;
  } else if (isExistingStateMode(stateMode)) {
    const fullFileName = path.join(deployDir, stateMode.file);
    if (!fs.existsSync(fullFileName)) {
      throw new Error(`File '${stateMode.file}' does not exists`);
    }
    if (!fs.statSync(fullFileName).isFile()) {
      throw new Error(`Not a file: '${stateMode.file}'`);
    }
    if (path.extname(fullFileName) !== '.json') {
      throw new Error('State file must have json extension');
    }
    log(`Using existing state file '${stateMode.file}'`);
    return stateMode.file;
  } else {
    throw new Error('Unknown state mode');
  }
}

async function deployCommandTemplate(
  command: Command,
  deployCommandArgs: DeployCommandArgs,
  perform: (
    signer: ethers.Signer,
    actualConfigFile: string,
    actualStateFile: string,
    actualDeploymentFile: string,
  ) => Promise<void>,
) {
  const statesDirName = 'states';

  let deployDir: string;

  if (command.args.length === 0) {
    log('Positional arg is not passed. Assuming deploy dir is current dir');
    deployDir = '.';
  } else if (command.args.length === 1) {
    deployDir = command.args[0];
  } else {
    throw new Error('Command expects either no positional arguments or exactly one');
  }

  const stateMode = parseStateMode(deployCommandArgs.stateMode, deployCommandArgs.stateFile);

  if (!fs.existsSync(deployDir)) {
    throw new Error(`Directory '${deployDir}' does not exists`);
  }
  if (!fs.statSync(deployDir).isDirectory()) {
    throw new Error(`Specified '${deployDir}' is not a directory`);
  }

  if ((isNewStateMode(stateMode) || isExistingStateMode(stateMode)) && stateMode.file !== undefined) {
    const fileName = stateMode.file;

    const statesDir = path.join(deployDir, statesDirName);

    const relativeFileName = path.relative(statesDir, fileName);

    const pathParts = relativeFileName.split(path.sep);

    if (pathParts.length === 0) {
      throw new Error('Path to state file is empty');
    }
    if (pathParts[0] === '..') {
      throw new Error('State file is outside state dir');
    }
  }

  const config: DeployConfig = JSON.parse(fs.readFileSync(path.join(deployDir, 'config.json'), 'utf-8'));
  const { signer, dryRun } = await readEthDeploy(command, config);

  if (dryRun) {
    const osTmpDir = os.tmpdir();
    const tmpDir = fs.mkdtempSync(path.join(osTmpDir, 'marginly_deploy_'));
    log(`Created tmp dir for writing deploy files: ${tmpDir}`);

    fse.copySync(deployDir, tmpDir, { preserveTimestamps: true });
    deployDir = tmpDir;
  }

  const statesDir = path.join(deployDir, statesDirName);

  if (!fs.existsSync(statesDir)) {
    fs.mkdirSync(statesDir);
  }

  if (!fs.statSync(statesDir).isDirectory()) {
    throw new Error(`Not a directory: ${statesDir}`);
  }

  const actualConfigFile = path.join(deployDir, 'config.json');

  const stateFileName = getStateFileName(deployDir, statesDirName, stateMode);
  const actualStateFile = path.join(deployDir, stateFileName);

  const actualDeploymentFile = path.join(deployDir, 'deployment.json');

  if (!fs.existsSync(actualConfigFile) || !fs.statSync(actualConfigFile)) {
    throw new Error('Config file not found');
  }

  await perform(signer, actualConfigFile, actualStateFile, actualDeploymentFile);
}

interface NewStateMode {
  type: 'new';
  file?: string;
}

interface LatestStateMode {
  type: 'latest';
}

interface ExistingStateMode {
  type: 'existing';
  file: string;
}

type StateMode = NewStateMode | LatestStateMode | ExistingStateMode;

function isNewStateMode(stateMode: StateMode): stateMode is NewStateMode {
  return stateMode.type === 'new';
}

function isLatestStateMode(stateMode: StateMode): stateMode is LatestStateMode {
  return stateMode.type === 'latest';
}

function isExistingStateMode(stateMode: StateMode): stateMode is ExistingStateMode {
  return stateMode.type === 'existing';
}

interface DeployCommandArgs {
  stateMode: string;
  stateFile?: string;
}

function parseStateMode(stateMode: string, stateFile?: string): StateMode {
  if (stateMode === 'new') {
    return {
      type: 'new',
      file: stateFile,
    };
  } else if (stateMode === 'latest') {
    if (stateFile !== undefined) {
      throw new Error('State file must not be specified for latest mode');
    }
    return {
      type: 'latest',
    };
  } else if (stateMode === 'existing') {
    if (stateFile === undefined) {
      throw new Error('State file must be specified for existing mode');
    }
    return {
      type: 'existing',
      file: stateFile,
    };
  } else {
    throw new Error(`Unknown state mode '${stateMode}'`);
  }
}

function generateStateFileName(dirName: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = 1 + now.getUTCMonth();
  const day = now.getUTCDate();
  const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  let fileName = `${dateStr}.json`;
  if (fs.existsSync(path.join(dirName, fileName))) {
    const maxCount = 99;
    let n = 1;
    while (fs.existsSync(path.join(dirName, fileName))) {
      if (n === maxCount) {
        throw new Error('Too much state files today');
      }
      fileName = `${dateStr}_${n.toString().padStart(2, '0')}.json`;
      n++;
    }
  }
  return fileName;
}

function getLatestStateFileName(dirName: string): string {
  const fileNames = fs.readdirSync(dirName);
  const files = fileNames
    .map((x) => ({
      name: x,
      extension: path.extname(x),
      mtimeNs: fs.statSync(path.join(dirName, x), { bigint: true }).mtimeNs,
    }))
    .filter((x) => x.extension === '.json')
    .sort((a, b) => Number(b.mtimeNs - a.mtimeNs));

  if (files.length === 0) {
    throw new Error('No state file found');
  }

  return files[0].name;
}

export function createDefaultBaseState(): BaseState {
  return { contracts: {} };
}

export class StateFile<TState extends BaseState> {
  private readonly stateName: string;
  private readonly createDefaultState: () => TState;
  private readonly fileName: string;
  private readonly logger: Logger;

  constructor(name: string, createDefaultState: () => TState, fileName: string, logger: Logger) {
    this.stateName = name;
    this.createDefaultState = createDefaultState;
    this.fileName = fileName;
    this.logger = logger;
  }

  public getStateFromFile(): TState {
    if (fs.existsSync(this.fileName)) {
      return JSON.parse(fs.readFileSync(this.fileName, 'utf-8'));
    } else {
      this.logger.log(`${this.stateName} state file not found, a new one will created`);
    }

    return this.createDefaultState();
  }

  public saveStateFileChanges(state: TState) {
    const s = JSON.stringify(state, null, 2);
    fs.writeFileSync(this.fileName, s, { encoding: 'utf8' });
  }

  public createStateStore(): StateStore {
    const state = this.getStateFromFile();
    return {
      getById: (id: string): DeployState | undefined => {
        return state.contracts[id];
      },
      setById: (id: string, deployState: DeployState) => {
        state.contracts[id] = deployState;
        this.saveStateFileChanges(state);
      },
    };
  }
}

const deployMarginlyCommand = new Command('marginly')
  .requiredOption('--state-mode <stateMode>', 'Mode to process state: new, latest, existing')
  .option('--state-file <stateFile>', 'State file name for new and existing state modes')
  .action(async (deployCommandArgs: DeployCommandArgs, command: Command) => {
    await deployCommandTemplate(
      command,
      deployCommandArgs,
      async (signer, actualConfigFile, actualStateFile, actualDeploymentFile) => {
        const logger = new SimpleLogger((x) => console.error(x));
        const stateStore = new StateFile(
          'Marginly',
          createDefaultBaseState,
          actualStateFile,
          logger,
        ).createStateStore();
        const rawConfig = JSON.parse(fs.readFileSync(actualConfigFile, 'utf-8'));

        const marginlyDeployment = await deployMarginly(signer, rawConfig, stateStore, logger);

        updateDeploymentFile(actualDeploymentFile, marginlyDeployment, logger);
      },
    );
  });

function updateDeploymentFile(deploymentFile: string, currentDeployment: MarginlyDeployment, logger: Logger) {
  let existingDeployment: MarginlyDeployment;

  if (fs.existsSync(deploymentFile)) {
    logger.log('Found existing deployment file');
    existingDeployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf-8'));
  } else {
    logger.log('Deployment file not found. Creating new one');
    existingDeployment = {
      marginlyPools: [],
    };
  }

  const mergedDeployment = mergeMarginlyDeployments(existingDeployment, currentDeployment);

  fs.writeFileSync(deploymentFile, JSON.stringify(mergedDeployment, null, 2), { encoding: 'utf-8' });
}

export const readReadOnlyEthFromContext = async (
  systemContext: SystemContext,
): Promise<{ nodeUri: { parameter: Parameter; value: string } }> => {
  const nodeUri = readParameter(nodeUriParameter, systemContext);

  if (!nodeUri) {
    throw new Error('Unable to determine Eth Node Uri');
  }

  return {
    nodeUri: {
      parameter: nodeUriParameter,
      value: nodeUri,
    },
  };
};

export const readReadWriteEthFromContext = async (
  systemContext: SystemContext,
): Promise<{
  signer: ethers.Signer;
  dryRun: boolean;
}> => {
  const nodeUri = await readReadOnlyEthFromContext(systemContext);

  const dryRun = readFlag(dryRunParameter, systemContext);
  const dryRunOpts = readParameter(dryRunOptsParameter, systemContext);

  if (!dryRun && dryRunOpts !== undefined) {
    throw new Error('Dry run options can only be set while dry run mode is enabled');
  }

  if (dryRunOpts !== undefined && dryRunOpts !== 'fund') {
    throw new Error(`Unknown dry run option '${dryRunOpts}'`);
  }

  const realProvider = new ethers.providers.JsonRpcProvider(nodeUri.nodeUri.value);
  let provider;
  if (!dryRun) {
    provider = realProvider;
  } else {
    log(`Dry run command on fork`);
    const { chainId: realChainId } = await realProvider.getNetwork();
    const options = {
      chain: { chainId: realChainId },
      logging: { quiet: true },
      fork: { url: nodeUri.nodeUri.value },
    };
    provider = new ethers.providers.Web3Provider(
      ganache.provider(options) as unknown as ethers.providers.ExternalProvider,
    );
    const blockNumber = await provider.getBlockNumber();
    log(`Fork block number: ${blockNumber}`);
  }

  const signer = (await readEthSignerFromContext(systemContext)).connect(provider);

  if (dryRun && dryRunOpts === 'fund') {
    const treasurySigner = provider.getSigner();
    await treasurySigner.sendTransaction({
      to: await signer.getAddress(),
      value: ethers.utils.parseEther('100'),
    });
    const signerBalance = (await signer.getBalance()).toBigInt();
    signerBalance.toString();
  }

  return {
    signer,
    dryRun,
  };
};
export const registerReadOnlyEthParameters = (command: Command): Command => {
  return command.option(getCommanderForm(nodeUriParameter), nodeUriParameter.description);
};

export const registerReadWriteEthParameters = (command: Command): Command => {
  return registerEthSignerParameters(registerReadOnlyEthParameters(command)).option(
    getCommanderFlagForm(dryRunParameter),
    dryRunParameter.description,
  ).option(
    getCommanderForm(dryRunOptsParameter),
    dryRunOptsParameter.description,
  );
};

export const deployCommand = registerReadWriteEthParameters(new Command('deploy')).addCommand(deployMarginlyCommand);
