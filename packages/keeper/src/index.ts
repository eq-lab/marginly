import { Command, Option } from 'commander';
import 'dotenv/config';
import { sleep, ContractDescription } from '@marginly/common';
import {
  createSystemContext,
  getCommanderForm,
  Parameter,
  readEthSignerFromContext,
  readParameter,
  SystemContext,
  ethKeyTypeParameter,
  ethKeyFileParameter,
  ethKeyPasswordParameter,
} from '@marginly/cli-common';
import { createRootLogger, jsonFormatter, LogFormatter, textFormatter } from '@marginly/logger';
import { stdOutWriter } from '@marginly/logger-node';
import * as fs from 'fs';
import { ethers } from 'ethers';
import { MarginlyKeeperWorker } from './MarginlyKeeperWorker';
import { createPoolWatchers } from './PoolWatcher';
import { ContractDescriptions, KeeperArgs, KeeperConfig, KeeperParamter } from './types';

function createLogFormatter(format: string): LogFormatter {
  if (format == 'text') {
    return textFormatter;
  } else if (format == 'json') {
    return jsonFormatter;
  } else {
    throw new Error(`Configuration error, log format "${format}" not supported`);
  }
}

async function readReadOnlyEthFromContext(
  systemContext: SystemContext
): Promise<{ nodeUri: { parameter: Parameter; value: string } }> {
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
}

async function createSignerFromContext(systemContext: SystemContext): Promise<ethers.Signer> {
  const nodeUri = await readReadOnlyEthFromContext(systemContext);

  const provider = new ethers.providers.JsonRpcProvider(nodeUri.nodeUri.value);
  const signer = (await readEthSignerFromContext(systemContext)).connect(provider);

  return signer;
}

function createMarginlyContractDescription(name: string): ContractDescription {
  return require(`@marginly/contracts/artifacts/contracts/${name}.sol/${name}.json`);
}

function createKeeperContractDescription(name: string): ContractDescription {
  return require(`@marginly/contracts/artifacts/contracts/keepers/${name}.sol/${name}.json`);
}

function createOpenZeppelinContractDescription(name: string): ContractDescription {
  return require(`@openzeppelin/contracts/build/contracts/${name}.json`);
}

function createAaveIPoolContractDescription(): ContractDescription {
  return require(`@aave/core-v3/artifacts/contracts/interfaces/IPool.sol/IPool.json`);
}

function createUniswapV3ContractDescription(): ContractDescription {
  return require(`@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json`);
}

function prepareContractDescriptions(): ContractDescriptions {
  return {
    token: createOpenZeppelinContractDescription('IERC20Metadata'),
    keeperAave: createMarginlyContractDescription('MarginlyKeeper'),
    keeperUniswapV3: createMarginlyContractDescription('MarginlyKeeperUniswapV3'),
    marginlyPool: createMarginlyContractDescription('MarginlyPool'),
    aavePool: createAaveIPoolContractDescription(),
    uniswapPool: createUniswapV3ContractDescription(),
  };
}

const ENV_PREFIX: string = 'MARGINLY_KEEPER';

const configParameter: KeeperParamter = {
  name: ['config'],
  description: 'Path to config file',
  default: 'raw',
  env: `${ENV_PREFIX}_CONFIG`,
};

const logFormatParamter: KeeperParamter = {
  name: ['log', 'format'],
  description: "Log format 'text' or 'json'",
  default: 'json',
  env: `${ENV_PREFIX}_LOG_FORMAT`,
};

const logLevelParamter: KeeperParamter = {
  name: ['log', 'level'],
  description: 'Log level: 1-Verbose,2-Debug,3-Information,4-Warning,5-Error,6-Fatal',
  default: '3',
  env: `${ENV_PREFIX}_LOG_LEVEL`,
};

const nodeUriParameter: KeeperParamter = {
  name: ['eth', 'node', 'uri'],
  description: 'Eth Node URI',
  env: `${ENV_PREFIX}_ETH_NODE_URI`,
};

const ethKeyParameter: KeeperParamter = {
  name: ['eth', 'key'],
  description: 'Signer private key',
  env: `${ENV_PREFIX}_ETH_KEY`,
};

const createCommanderOption = (parameter: KeeperParamter): Option => {
  let option = new Option(getCommanderForm(parameter), parameter.description).env(parameter.env!);
  if (parameter.default) {
    option = option.default(parameter.default);
  }

  return option;
};

const watchMarginlyPoolsCommand = new Command()
  .addOption(createCommanderOption(configParameter))
  .addOption(createCommanderOption(logFormatParamter))
  .addOption(createCommanderOption(logLevelParamter))
  .addOption(createCommanderOption(nodeUriParameter))
  .option(getCommanderForm(ethKeyTypeParameter), ethKeyTypeParameter.description)
  .addOption(createCommanderOption(ethKeyParameter))
  .option(getCommanderForm(ethKeyFileParameter), ethKeyFileParameter.description)
  .option(getCommanderForm(ethKeyPasswordParameter), ethKeyPasswordParameter.description)
  .action(async (commandArgs: KeeperArgs, command: Command) => {
    const config: KeeperConfig = JSON.parse(fs.readFileSync(commandArgs.config, 'utf-8'));
    const systemContext = createSystemContext(command, config.systemContextDefaults);

    const logger = createRootLogger(
      'marginlyKeeper',
      stdOutWriter(createLogFormatter(commandArgs.logFormat)),
      commandArgs.logLevel
    );

    let keeperWorker: MarginlyKeeperWorker | undefined;
    process.on('SIGTERM', () => {
      logger.info('On sigterm');
      keeperWorker?.requestStop();
    });

    process.on('SIGINT', () => {
      logger.info('On sigint');
      keeperWorker?.requestStop();
    });
    logger.info(`Service started with config:"${commandArgs.config}", log-level: ${commandArgs.logLevel}`);

    const signer = await createSignerFromContext(systemContext);
    const contractDescriptions = prepareContractDescriptions();

    const keeperAaveContract: ethers.Contract | undefined = config.marginlyKeeperAaveAddress
      ? new ethers.Contract(config.marginlyKeeperAaveAddress, contractDescriptions.keeperAave.abi, signer.provider)
      : undefined;

    const keeperUniswapV3Contract: ethers.Contract | undefined = config.marginlyKeeperUniswapV3Address
      ? new ethers.Contract(
          config.marginlyKeeperUniswapV3Address,
          contractDescriptions.keeperUniswapV3.abi,
          signer.provider
        )
      : undefined;

    const poolWatchers = await createPoolWatchers(
      logger,
      config,
      contractDescriptions.token,
      contractDescriptions.marginlyPool,
      signer.provider
    );

    keeperWorker = new MarginlyKeeperWorker(
      signer,
      contractDescriptions,
      poolWatchers,
      keeperAaveContract,
      keeperUniswapV3Contract,
      config.connection.ethOptions,
      logger
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        if (keeperWorker.isStopRequested()) {
          break;
        }

        await keeperWorker.run();
      } catch (error) {
        logger.error(error);
      }

      await sleep(3000);
    }
  });

const main = async () => {
  await watchMarginlyPoolsCommand.parseAsync(process.argv);
};

(async () => {
  main().catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  });
})();
