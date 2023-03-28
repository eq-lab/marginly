import { startSuite } from './suites';
import ganache from 'ganache';
import { writeFile } from 'fs/promises';
import { INITIAL_BALANCE, SECS_PER_BLOCK, USDC_OWNER_ADDR } from './utils/const';
import { logger } from './utils/logger';
import { Web3Provider } from '@ethersproject/providers';

(async (): Promise<void> => {
  const logFile = `.ganache.stdout.log`;
  await writeFile(logFile, ``, { flag: `w` });

  let suiteName = process.argv[2].substring('--suite='.length);
  if (!suiteName) {
    throw `Suite name argument not passed. Run script with argument --suite=<suiteName>`;
  }

  const server = ganache.server({
    fork: {
      url: `https://rpc.ankr.com/eth`,
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
  server.listen(8545, `127.0.0.1`).catch((err) => logger.fatal(JSON.stringify(err)));

  const provider = new Web3Provider(server.provider as any);
  let initialAccounts = Object.entries(server.provider.getInitialAccounts());

  try {
    await startSuite(provider, initialAccounts, suiteName);
    return;
  } catch (err) {
    if (typeof err == 'object') {
      console.log(Math.floor(Date.now() / 1000));
      logger.error(JSON.stringify(err, null, 2));
    } else {
      logger.error(`${err}`);
    }
  } finally {
    await server.provider.disconnect();
    await server.close();
  }
})();
