import { Command } from 'commander';
import { deployCommand } from './command/deploy';
import { ethereumKeyringCommand } from '@marginly/common';

const main = async () => {
  const program = new Command();
  program.addCommand(deployCommand).addCommand(ethereumKeyringCommand);

  await program.parseAsync(process.argv);
};

(async () => {
  main().catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  });
})();
