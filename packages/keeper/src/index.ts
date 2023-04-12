import { Command } from 'commander';
import { getCommanderForm, registerEthSignerParameters } from '@marginly/common';

const nodeUriParameter = {
  name: ['eth', 'node', 'uri'],
  description: 'Eth Node URI',
};

interface KeeperArgs {
  config: string;
}

const watchPools = new Command().action(async (watchCommandArgs: KeeperArgs, command: Command) => {
  //
  console.log(`Command run`);
  console.log(watchCommandArgs);
});

export const registerReadOnlyEthParameters = (command: Command): Command => {
  return registerEthSignerParameters(command.option(getCommanderForm(nodeUriParameter), nodeUriParameter.description));
};

const main = async () => {
  const program = registerReadOnlyEthParameters(watchPools);

  await program.parseAsync(process.argv);
};

(async () => {
  main().catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  });
})();
