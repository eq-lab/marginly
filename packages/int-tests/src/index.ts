import { startSuite } from './suites';
import ganache from 'ganache';
import { writeFile } from 'fs/promises';
import { INITIAL_BALANCE, USDC_OWNER_ADDR } from './utils/const';
import { logger } from './utils/logger';
import { Web3Provider } from '@ethersproject/providers';

(async (): Promise<void> => {
  const logFile = `.ganache.stdout.log`;
  await writeFile(logFile, ``, { flag: `w` });

  const suiteName = process.argv[2].substring('--suite='.length);
  if (!suiteName) {
    throw `Suite name argument not passed. Run script with argument --suite=<suiteName>`;
  }

  const forkBlockNumber = 17265384;
  const server = ganache.server({
    fork: {
      url: `https://eth.llamarpc.com`,
      blockNumber: forkBlockNumber,
    },
    wallet: {
      totalAccounts: 100,
      unlockedAccounts: [USDC_OWNER_ADDR],
      defaultBalance: 10 * +INITIAL_BALANCE,
    },
    logging: {
      verbose: true,
      logger: {
        log: async (message?: any) => {
          await writeFile(logFile, `${message}\n`, { flag: `a` });
        },
      },
    },
  });
  logger.info(`⛓️ Fork on block ${forkBlockNumber}`);
  server.listen(8545, `127.0.0.1`).catch((err) => logger.fatal(JSON.stringify(err)));

  const provider = new Web3Provider(server.provider as any);
  const initialAccounts = Object.entries(server.provider.getInitialAccounts());

  try {
    await startSuite(provider, initialAccounts, suiteName);
  } catch (err) {
    console.log(Math.floor(Date.now() / 1000));
    logger.error(`${err}`);

    process.exit(1);
  } finally {
    await server.provider.disconnect();
    await server.close();
  }
})();
