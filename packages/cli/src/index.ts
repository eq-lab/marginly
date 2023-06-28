import { Command } from 'commander';
import { deployCommand } from './command/deploy';
import { ethereumKeyringCommand } from '@marginly/cli-common';
import { sbtCommand } from './command/sbt';

const main = async () => {
  const program = new Command();
  program.addCommand(deployCommand).addCommand(ethereumKeyringCommand).addCommand(sbtCommand);

  await program.parseAsync(process.argv);
};

(async () => {
  main().catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  });
})();
