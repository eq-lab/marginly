import { Command, Option } from 'commander';
import {
  RationalNumber,
  MarginlyPoolParameters,
  PositionType,
  Fp96One,
  Fp96,
  MarginlyMode,
  Position,
  sleep,
  ContractDescription,
  HeapNode,
} from '@marginly/common';
import { Logger } from '@marginly/common/logger';
import { Worker } from '@marginly/common/lifecycle';
import { using } from '@marginly/common/resource';
import {
  createSystemContext,
  getCommanderForm,
  registerEthSignerParameters,
  Parameter,
  readEthSignerFromContext,
  readParameter,
  SystemContext,
} from '@marginly/cli-common';
import { createRootLogger, jsonFormatter, LogFormatter, LogLevel, textFormatter } from '@marginly/logger';
import { stdOutWriter } from '@marginly/logger-node';
import * as fs from 'fs';
import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { formatEther, formatUnits } from 'ethers/lib/utils';

export interface LogConfig {
  level: number;
  format: string;
}

interface EthOptions {
  gasLimit?: number;
  gasPrice?: number;
}

interface EthConnectionConfig {
  ethOptions: EthOptions;
}

interface KeeperConfig {
  systemContextDefaults?: Record<string, string>;
  connection: EthConnectionConfig;
  marginlyKeeperAddress: string;
  marginlyPools: {
    address: string;
    minProfitQuote: string;
    minProfitBase: string;
  }[];
  log?: LogConfig;
}

interface ContractDescriptions {
  token: ContractDescription;
  keeper: ContractDescription;
  marginlyPool: ContractDescription;
}

const nodeUriParameter = {
  name: ['eth', 'node', 'uri'],
  description: 'Eth Node URI',
};

interface KeeperArgs {
  config: string;
  logFormat: 'text' | 'json';
  logLevel: LogLevel;
}

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

function createOpenZeppelinContractDescription(name: string): ContractDescription {
  return require(`@openzeppelin/contracts/build/contracts/${name}.json`);
}

function prepareContractDescriptions(): ContractDescriptions {
  return {
    token: createOpenZeppelinContractDescription('IERC20Metadata'),
    keeper: createMarginlyContractDescription('MarginlyKeeper'),
    marginlyPool: createMarginlyContractDescription('MarginlyPool'),
  };
}

type LiquidationParams = {
  position: string;
  pool: string;
  asset: string;
  amount: BigNumber;
  minProfit: BigNumber;
};

type PoolCoeffs = {
  baseCollateralCoeffX96: BigNumber;
  baseDebtCoeffX96: BigNumber;
  quoteCollateralCoeffX96: BigNumber;
  quoteDebtCoeffX96: BigNumber;
  baseDelevCoeffX96: BigNumber;
  quoteDelevCoeffX96: BigNumber;
};

class PoolWatcher {
  private readonly logger: Logger;
  public readonly pool: ethers.Contract;
  public readonly minProfitQuote: BigNumber;
  public readonly minProfitBase: BigNumber;

  public constructor(pool: ethers.Contract, minProfitQuote: BigNumber, minProfitBase: BigNumber, logger: Logger) {
    this.pool = pool;
    this.minProfitQuote = minProfitQuote;
    this.minProfitBase = minProfitBase;
    this.logger = logger;
  }

  public async findBadPositions(): Promise<LiquidationParams[]> {
    const [
      basePrice,
      params,
      mode,
      baseCollateralCoeff,
      baseDebtCoeff,
      quoteCollateralCoeff,
      quoteDebtCoeff,
      baseDelevCoeff,
      quoteDelevCoeff,
    ]: [Fp96, MarginlyPoolParameters, number, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] =
      await Promise.all([
        this.pool.getBasePrice(),
        this.pool.params(),
        this.pool.mode(),
        this.pool.baseCollateralCoeff(),
        this.pool.baseDebtCoeff(),
        this.pool.quoteCollateralCoeff(),
        this.pool.quoteDebtCoeff(),
        this.pool.baseDelevCoeff(),
        this.pool.quoteDelevCoeff(),
      ]);

    const basePriceX96 = BigNumber.from(basePrice.inner);

    const poolCoeffs: PoolCoeffs = {
      baseCollateralCoeffX96: baseCollateralCoeff,
      baseDebtCoeffX96: baseDebtCoeff,
      quoteCollateralCoeffX96: quoteCollateralCoeff,
      quoteDebtCoeffX96: quoteDebtCoeff,
      quoteDelevCoeffX96: baseDelevCoeff,
      baseDelevCoeffX96: quoteDelevCoeff,
    };

    if (mode != MarginlyMode.Regular) {
      this.logger.info(`Pool ${this.pool.address} in emergency mode. Liquidation not available`);
      return [];
    }

    const maxLeverage = params.maxLeverage;
    const riskiestPositions = await Promise.all([this.getRiskiestShortPosition(), this.getRiskiestLongPosition()]);

    const result: LiquidationParams[] = [];

    for (const positionAddress of riskiestPositions) {
      if (positionAddress) {
        const liquidationParams = await this.checkPosition(positionAddress, basePriceX96, maxLeverage, poolCoeffs);
        if (liquidationParams) {
          result.push(liquidationParams);
        }
      }
    }

    return result;
  }

  private async getRiskiestShortPosition(): Promise<string | null> {
    const [success, node]: [boolean, HeapNode] = await this.pool.getHeapPosition(0, true);
    return success ? node.account : null;
  }

  private async getRiskiestLongPosition(): Promise<string | null> {
    const [success, node]: [boolean, HeapNode] = await this.pool.getHeapPosition(0, false);
    return success ? node.account : null;
  }

  private async checkPosition(
    positionAddress: string,
    basePriceX96: BigNumber,
    maxLeverage: BigNumber,
    poolCoeffs: PoolCoeffs
  ): Promise<LiquidationParams | null> {
    const position: Position = await this.pool.positions(positionAddress);

    if (position._type == PositionType.Short) {
      const debt = BigNumber.from(position.discountedBaseAmount).mul(poolCoeffs.baseDebtCoeffX96).div(Fp96One);
      const debtInQuote = debt.mul(basePriceX96).div(Fp96One);
      const collateral = BigNumber.from(position.discountedQuoteAmount)
        .mul(poolCoeffs.quoteCollateralCoeffX96)
        .div(Fp96One)
        .sub(poolCoeffs.quoteDelevCoeffX96.mul(position.discountedBaseAmount).div(Fp96One));

      const leverage = collateral.div(collateral.sub(debtInQuote));
      return leverage > maxLeverage
        ? {
            position: positionAddress,
            asset: await this.pool.baseToken(),
            amount: debt,
            minProfit: this.minProfitBase,
            pool: this.pool.address,
          }
        : null;
    } else if (position._type == PositionType.Long) {
      const debt = BigNumber.from(position.discountedQuoteAmount).mul(poolCoeffs.quoteDebtCoeffX96).div(Fp96One);
      const collateral = BigNumber.from(position.discountedBaseAmount)
        .mul(poolCoeffs.baseCollateralCoeffX96)
        .div(Fp96One)
        .sub(poolCoeffs.baseDelevCoeffX96.mul(position.discountedQuoteAmount).div(Fp96One));
      const collateralInQuote = collateral.mul(basePriceX96).div(Fp96One);

      const leverage = collateralInQuote.div(collateralInQuote.sub(debt));
      return leverage > maxLeverage
        ? {
            position: positionAddress,
            asset: await this.pool.quoteToken(),
            amount: debt,
            minProfit: this.minProfitQuote,
            pool: this.pool.address,
          }
        : null;
    } else {
      return null;
    }
  }
}

async function createPoolWatchers(
  logger: Logger,
  config: KeeperConfig,
  tokenContractDescription: ContractDescription,
  marginlyPoolContractDescription: ContractDescription,
  provider?: ethers.providers.Provider
): Promise<PoolWatcher[]> {
  const getERC20Decimals = async (tokenAddress: string): Promise<number> => {
    const tokenContract = new ethers.Contract(tokenAddress, tokenContractDescription.abi, provider);
    return await tokenContract.decimals();
  };

  return Promise.all(
    config.marginlyPools.map(async (c) => {
      const marginlyPoolContract = new ethers.Contract(c.address, marginlyPoolContractDescription.abi, provider);
      const quoteDecimals: number = await getERC20Decimals(await marginlyPoolContract.quoteToken());
      const quoteOne = BigNumber.from(10).pow(quoteDecimals);
      const minProfitQuote = RationalNumber.parse(c.minProfitQuote).mul(quoteOne).toInteger();

      const baseDecimals: number = await getERC20Decimals(await marginlyPoolContract.baseToken());
      const baseOne = BigNumber.from(10).pow(baseDecimals);
      const minProfitBase = RationalNumber.parse(c.minProfitBase).mul(baseOne).toInteger();

      return new PoolWatcher(marginlyPoolContract, minProfitQuote, minProfitBase, logger);
    })
  );
}

class MarginlyKeeperWorker implements Worker {
  private readonly logger: Logger;
  private readonly signer: ethers.Signer;
  private readonly keeperContract: ethers.Contract;
  private readonly contractDescriptions: any;
  private readonly poolWatchers: PoolWatcher[];
  private readonly ethOptions: EthOptions;

  private stopRequested: boolean;

  constructor(
    signer: ethers.Signer,
    contractDescriptions: ContractDescriptions,
    poolWatchers: PoolWatcher[],
    keeperContract: ethers.Contract,
    ethOptions: EthOptions,
    logger: Logger
  ) {
    this.signer = signer;
    this.keeperContract = keeperContract;
    this.logger = logger;
    this.contractDescriptions = contractDescriptions;
    this.poolWatchers = poolWatchers;
    this.ethOptions = ethOptions;

    this.stopRequested = false;
  }

  requestStop(): void {
    this.stopRequested = true;
  }

  public isStopRequested(): boolean {
    return this.stopRequested;
  }

  async run(): Promise<void> {
    for (const poolWatcher of this.poolWatchers) {
      if (this.stopRequested) {
        return;
      }

      const scopeName = `PoolWatcher ${poolWatcher.pool.address}`;
      await using(this.logger.scope(scopeName), async (logger) => {
        logger.debug(`Check pool ${poolWatcher.pool.address}`);

        const liquidationParams = await poolWatcher.findBadPositions();
        logger.debug(`Found ${liquidationParams.length} bad positions`);

        for (const liquidationParam of liquidationParams) {
          const refferalCode = 0;

          const debtTokenContract = new ethers.Contract(
            liquidationParam.asset,
            this.contractDescriptions.token.abi,
            this.signer.provider
          );

          try {
            logger.info(`Send tx to liquidate position with params`, liquidationParam);

            await this.logBalanceChange(logger, debtTokenContract, async () => {
              await this.keeperContract
                .connect(this.signer)
                .flashLoan(
                  liquidationParam.asset,
                  liquidationParam.amount,
                  refferalCode,
                  liquidationParam.pool,
                  liquidationParam.position,
                  liquidationParam.minProfit,
                  this.ethOptions
                );
            });
          } catch (error) {
            logger.augmentError(error);
          }
        }
      });
    }
  }

  private async logBalanceChange(logger: Logger, token: ethers.Contract, action: () => Promise<void>): Promise<void> {
    const signerAddress = await this.signer.getAddress();
    const [, balanceBefore, ethBalanceBefore] = await Promise.all([
      ,
      token.balanceOf(signerAddress),
      this.signer.getBalance(),
    ]);

    await action();

    const [balanceAfter, symbol, decimals, ethBalanceAfter]: [BigNumber, string, number, BigNumber] = await Promise.all(
      [token.balanceOf(signerAddress), token.symbol(), token.decimals(), this.signer.getBalance()]
    );

    logger.info(
      `Liquidation profit = ${balanceAfter} - ${balanceBefore} = ${formatUnits(
        balanceAfter.sub(balanceBefore),
        decimals
      )} ${symbol}. Tx fee = ${ethBalanceBefore} - ${ethBalanceAfter} = ${formatEther(
        ethBalanceBefore.sub(ethBalanceAfter)
      )} ETH`
    );
  }
}

const watchMarginlyPoolsCommand = new Command()
  .addOption(new Option('-c, --config <path to config>', 'Path to config file').env(`KEEPER_CONFIG`))
  .addOption(
    new Option('--log-format <log format>', "Log format 'text' or 'json'").default('json').env(`KEEPER_LOG_FORMAT`)
  )
  .addOption(
    new Option('--log-level <log level>', 'Log level: 1-Verbose,2-Debug,3-Information,4-Warning,5-Error,6-Fatal')
      .default(LogLevel.Information)
      .env(`KEEPER_LOG_LEVEL`)
  )
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
    const keeperContract = new ethers.Contract(
      config.marginlyKeeperAddress,
      contractDescriptions.keeper.abi,
      signer.provider
    );

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
      keeperContract,
      config.connection.ethOptions,
      logger
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await keeperWorker.run();
      if (keeperWorker.isStopRequested()) {
        break;
      }

      await sleep(3000);
    }
  });

function registerReadOnlyEthParameters(command: Command): Command {
  return registerEthSignerParameters(command.option(getCommanderForm(nodeUriParameter), nodeUriParameter.description));
}

const main = async () => {
  const program = registerReadOnlyEthParameters(watchMarginlyPoolsCommand);
  await program.parseAsync(process.argv);
};

(async () => {
  main().catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  });
})();
