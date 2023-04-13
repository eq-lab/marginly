import { Command } from 'commander';
import {
  createSystemContext,
  getCommanderForm,
  registerEthSignerParameters,
  Parameter,
  readEthSignerFromContext,
  readParameter,
  SystemContext,
  sleep,
} from '@marginly/common';
import * as fs from 'fs';
import { ethers } from 'ethers';

export interface KeeperConfig {
  systemContextDefaults?: Record<string, string>;
  marginlyKeeperAddress: string;
  aavePoolAdressesProviderAddress: string;
  uniswapRouterAddress: string;
  marginlyPools: {
    address: string;
    minProfitQuote: number;
    minProfitBase: number;
  }[];
}

const nodeUriParameter = {
  name: ['eth', 'node', 'uri'],
  description: 'Eth Node URI',
};

interface KeeperArgs {
  config: string;
}

const readReadOnlyEthFromContext = async (
  systemContext: SystemContext
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

const createSignerFromContext = async (systemContext: SystemContext): Promise<ethers.Signer> => {
  const nodeUri = await readReadOnlyEthFromContext(systemContext);

  const provider = new ethers.providers.JsonRpcProvider(nodeUri.nodeUri.value);
  const signer = (await readEthSignerFromContext(systemContext)).connect(provider);

  return signer;
};

const monitorMarginlyPoolsCommand = new Command()
  .requiredOption('-c, --config <path to config>', 'Path to config file')
  .action(async (commandArgs: KeeperArgs, command: Command) => {
    const config: KeeperConfig = JSON.parse(fs.readFileSync(commandArgs.config, 'utf-8'));
    const systemContext = createSystemContext(command, config.systemContextDefaults);

    const signer = await createSignerFromContext(systemContext);

    while (true) {
      for (const pool of config.marginlyPools) {
        console.log(pool.address);

        //connect to pool, read mode and params
        // get short bad position
        // get long bad position
        // try to liquidate
        // try to liquidate
      }

      await sleep(1000);
    }
  });

const registerReadOnlyEthParameters = (command: Command): Command => {
  return registerEthSignerParameters(command.option(getCommanderForm(nodeUriParameter), nodeUriParameter.description));
};

const main = async () => {
  const program = registerReadOnlyEthParameters(monitorMarginlyPoolsCommand);
  await program.parseAsync(process.argv);
};

(async () => {
  main().catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  });
})();
