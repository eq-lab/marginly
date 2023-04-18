import { Command } from 'commander';
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
import {
  createSystemContext,
  getCommanderForm,
  registerEthSignerParameters,
  Parameter,
  readEthSignerFromContext,
  readParameter,
  SystemContext,
} from '@marginly/cli-common';
import * as fs from 'fs';
import { ethers } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { formatEther, formatUnits } from 'ethers/lib/utils';

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
}

const nodeUriParameter = {
  name: ['eth', 'node', 'uri'],
  description: 'Eth Node URI',
};

interface KeeperArgs {
  config: string;
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

function prepareContractDescriptions() {
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
};

class PoolWatcher {
  public readonly pool: ethers.Contract;
  public readonly minProfitQuote: BigNumber;
  public readonly minProfitBase: BigNumber;

  public constructor(pool: ethers.Contract, minProfitQuote: BigNumber, minProfitBase: BigNumber) {
    this.pool = pool;
    this.minProfitQuote = minProfitQuote;
    this.minProfitBase = minProfitBase;
  }

  public async findBadPositions(): Promise<LiquidationParams[]> {
    const [basePrice, params, mode, baseCollateralCoeff, baseDebtCoeff, quoteCollateralCoeff, quoteDebtCoeff]: [
      Fp96,
      MarginlyPoolParameters,
      number,
      BigNumber,
      BigNumber,
      BigNumber,
      BigNumber
    ] = await Promise.all([
      this.pool.getBasePrice(),
      this.pool.params(),
      this.pool.mode(),
      this.pool.baseCollateralCoeff(),
      this.pool.baseDebtCoeff(),
      this.pool.quoteCollateralCoeff(),
      this.pool.quoteDebtCoeff(),
    ]);

    const basePriceX96 = BigNumber.from(basePrice.inner);

    const poolCoeffs: PoolCoeffs = {
      baseCollateralCoeffX96: baseCollateralCoeff,
      baseDebtCoeffX96: baseDebtCoeff,
      quoteCollateralCoeffX96: quoteCollateralCoeff,
      quoteDebtCoeffX96: quoteDebtCoeff,
    };

    if (mode > MarginlyMode.Recovery) {
      console.log('System in emergency mode. Liquidation not available');
      return [];
    }
    const maxLeverage: BigNumber = mode == MarginlyMode.Regular ? params.maxLeverage : params.recoveryMaxLeverage;

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
    const [success, node]: [boolean, HeapNode] = await this.pool.getShortHeapPosition(0);
    return success ? node.account : null;
  }

  private async getRiskiestLongPosition(): Promise<string | null> {
    const [success, node]: [boolean, HeapNode] = await this.pool.getLongHeapPosition(0);
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
        .div(Fp96One);

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
        .div(Fp96One);
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

      return new PoolWatcher(marginlyPoolContract, minProfitQuote, minProfitBase);
    })
  );
}

const watchMarginlyPoolsCommand = new Command()
  .requiredOption('-c, --config <path to config>', 'Path to config file')
  .action(async (commandArgs: KeeperArgs, command: Command) => {
    const config: KeeperConfig = JSON.parse(fs.readFileSync(commandArgs.config, 'utf-8'));
    const systemContext = createSystemContext(command, config.systemContextDefaults);

    const signer = await createSignerFromContext(systemContext);

    const contractDescriptions = prepareContractDescriptions();
    const keeperContract = new ethers.Contract(
      config.marginlyKeeperAddress,
      contractDescriptions.keeper.abi,
      signer.provider
    );

    const poolWatchers = await createPoolWatchers(
      config,
      contractDescriptions.token,
      contractDescriptions.marginlyPool,
      signer.provider
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      for (const poolWatcher of poolWatchers) {
        const liquidateioParams = await poolWatcher.findBadPositions();
        for (const liquidationParam of liquidateioParams) {
          const refferalCode = 0;

          const debtTokenContract = new ethers.Contract(
            liquidationParam.asset,
            contractDescriptions.token.abi,
            signer.provider
          );

          try {
            console.log(`Send tx to liquidate position with params`);
            console.log(liquidationParam);

            await logBalanceChange(signer, debtTokenContract, async () => {
              await keeperContract
                .connect(signer)
                .flashLoan(
                  liquidationParam.asset,
                  liquidationParam.amount,
                  refferalCode,
                  liquidationParam.pool,
                  liquidationParam.position,
                  liquidationParam.minProfit,
                  config.connection.ethOptions
                );
            });
          } catch (error) {
            console.error(`Liquidation failed with error: ${error}}`);
          }
        }

        await sleep(3000);
      }
    }
  });

async function logBalanceChange(signer: ethers.Signer, token: ethers.Contract, action: () => Promise<void>) {
  const signerAddress = await signer.getAddress();
  const [, balanceBefore, ethBalanceBefore] = await Promise.all([
    ,
    token.balanceOf(signerAddress),
    signer.getBalance(),
  ]);

  await action();

  const [balanceAfter, symbol, decimals, ethBalanceAfter]: [BigNumber, string, number, BigNumber] = await Promise.all([
    token.balanceOf(signerAddress),
    token.symbol(),
    token.decimals(),
    signer.getBalance(),
  ]);

  console.log(
    `Liquidation profit = ${balanceAfter} - ${balanceBefore} = ${formatUnits(
      balanceAfter.sub(balanceBefore),
      decimals
    )} ${symbol}`
  );
  console.log(
    `Tx fee = ${ethBalanceBefore} - ${ethBalanceAfter} = ${formatEther(ethBalanceBefore.sub(ethBalanceAfter))} ETH`
  );
}

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
