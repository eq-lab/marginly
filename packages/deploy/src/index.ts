import * as ethers from 'ethers';
import { Contract, ContractFactory, Signer } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { ContractDescription, ContractReader } from '@marginly/cli-common';
import { EthAddress, RationalNumber } from '@marginly/common';
import { EthConnectionConfig, EthOptions, MarginlyDeployConfig } from './config';

export { DeployConfig } from './config';

export interface DeployState {
  address: string;
  txHash?: string;
}

export interface BaseState {
  contracts: {
    [id: string]: DeployState;
  };
}

export function createDefaultBaseState(): BaseState {
  return { contracts: {} };
}

interface Closable {
  close(): void;
}

export interface Logger {
  log(message: string): void;

  beginScope(name: string): Closable;
}

type LoggerOutput = (message: string) => void;

class SimpleLoggerScope implements Closable {
  public readonly name;
  private readonly endScope: (scope: SimpleLoggerScope) => void;

  constructor(name: string, endScope: (scope: SimpleLoggerScope) => void) {
    this.name = name;
    this.endScope = endScope;
  }

  close(): void {
    this.endScope(this);
  }
}

export class SimpleLogger implements Logger {
  private readonly scopeStack: SimpleLoggerScope[] = [];
  private readonly output;

  public constructor(output: LoggerOutput) {
    this.output = output;
  }

  public beginScope(name: string): Closable {
    const scope = new SimpleLoggerScope(name, (scope) => this.endScope(scope));
    this.scopeStack.push(scope);

    this.log('');
    this.log(`${'#'.repeat(this.scopeStack.length)} ${name}`);
    this.log('');

    return scope;
  }

  private endScope(scope: SimpleLoggerScope): void {
    if (scope !== this.scopeStack[this.scopeStack.length - 1]) {
      throw new Error('Wrong scope closing order');
    }
    this.scopeStack.pop();
  }

  public log(message: string): void {
    this.output(message);
  }
}

function using<TVal extends Closable, TRet>(val: TVal, func: (val: TVal) => TRet) {
  try {
    return func(val);
  } finally {
    val.close();
  }
}

export interface StateStore {
  getById: (id: string) => DeployState | undefined;
  setById: (id: string, deployState: DeployState) => void;
}

function createMarginlyContractReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@marginly/contracts/artifacts/contracts/${name}.sol/${name}.json`);
  };
}

function createUniswapV3CoreInterfacesReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@uniswap/v3-core/artifacts/contracts/interfaces/${name}.sol/${name}.json`);
  };
}

function createOpenzeppelinContractReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@openzeppelin/contracts/build/contracts/${name}.json`);
  };
}

interface LimitedDeployResult extends DeployState {
  contract: Contract;
}

interface DeployResult extends DeployState {
  factory: ContractFactory;
  contract: Contract;
}

const deployTemplate = (
  signer: Signer,
  ethArgs: EthOptions,
  contractReader: (name: string) => ContractDescription,
  stateStore: StateStore,
  logger: Logger
) => {
  return async (name: string, args: unknown[], id: string): Promise<DeployResult> => {
    const contractDescription = contractReader(name);
    const factory = new ethers.ContractFactory(contractDescription.abi, contractDescription.bytecode, signer);

    const stateFromFile = stateStore.getById(id);
    if (stateFromFile) {
      logger.log(`Import ${name} contract from state file`);
      const contract = factory.attach(stateFromFile.address);
      return {
        address: stateFromFile.address,
        txHash: stateFromFile.txHash,
        factory: factory,
        contract: contract,
      };
    }

    const contract = await factory.deploy(...args, ethArgs);
    await contract.deployed();
    const result = {
      address: contract.address,
      txHash: contract.deployTransaction.hash,
      factory,
      contract,
    };
    stateStore.setById(id, {
      address: contract.address,
      txHash: contract.deployTransaction.hash,
    });
    return result;
  };
};

const printDeployState = (name: string, { address, txHash }: DeployState, logger: Logger) => {
  logger.log(`${name} address: ${address}, txHash: ${txHash ?? 'unknown'}`);
};

class MarginlyDeployer {
  private readonly readMarginlyContract;
  private readonly readUniswapCoreInterface;
  private readonly readOpenzeppelin;
  private readonly deploy;
  private readonly signer;
  private readonly ethArgs;
  private readonly provider;
  private readonly stateStore;
  private readonly logger;

  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    this.readMarginlyContract = createMarginlyContractReader();
    this.readUniswapCoreInterface = createUniswapV3CoreInterfacesReader();
    this.readOpenzeppelin = createOpenzeppelinContractReader();
    this.deploy = deployTemplate(signer, ethArgs, this.readMarginlyContract, stateStore, logger);
    this.ethArgs = ethArgs;
    this.signer = signer;

    if (signer.provider === undefined) {
      throw new Error('Provider is required');
    }
    this.provider = signer.provider;
    this.stateStore = stateStore;
    this.logger = logger;
  }

  public deployMarginlyPoolImplementation(): Promise<DeployResult> {
    return this.deploy('MarginlyPool', [], 'marginlyPoolImplementation');
  }

  public deployMarginlyFactory(
    marginlyPoolImplementation: EthAddress,
    uniswapFactory: EthAddress,
    swapRouter: EthAddress,
    feeHolder: EthAddress
  ): Promise<DeployResult> {
    return this.deploy(
      'MarginlyFactory',
      [marginlyPoolImplementation.toString(), uniswapFactory.toString(), swapRouter.toString(), feeHolder.toString()],
      'marginlyFactory'
    );
  }

  private static toUniswapFee(fee: RationalNumber): BigNumber {
    const uniswapFeeMultiplier = BigNumber.from('1000000');
    return fee.nom.mul(uniswapFeeMultiplier).div(fee.denom);
  }

  private async getCreatedUniswapPoolAddress(
    uniswapFactoryContract: ethers.Contract,
    txHash: string,
    token0: EthAddress,
    token1: EthAddress,
    fee: RationalNumber
  ): Promise<EthAddress> {
    if (token1.compare(token0) < 0) {
      const tmp = token0;
      token0 = token1;
      token1 = tmp;
    }

    const txReceipt = await this.provider.getTransactionReceipt(txHash);
    const eventFilter = uniswapFactoryContract.filters.PoolCreated(
      token0.toString(),
      token1.toString(),
      MarginlyDeployer.toUniswapFee(fee)
    );
    const events = await uniswapFactoryContract.queryFilter(eventFilter, txReceipt.blockHash);

    if (events.length === 0) {
      throw new Error('PoolCreated event not found');
    }
    if (events.length > 1) {
      throw new Error('Multiple PoolCreated events found');
    }
    const event = events[0];
    if (event.args === undefined) {
      throw new Error('PoolCreated event args are undefined');
    }

    const poolAddress = event.args[4];

    return EthAddress.parse(poolAddress);
  }

  public async getOrCreateUniswapPool(
    uniswapFactory: EthAddress,
    config: MarginlyConfigUniswapPool
  ): Promise<LimitedDeployResult> {
    const stateFileId = `uniswapPool_${config.id}`;
    const uniswapPoolContractDescription = this.readUniswapCoreInterface('IUniswapV3Pool');

    const stateFromFile = this.stateStore.getById(stateFileId);
    if (stateFromFile !== undefined) {
      this.logger.log(`Import IUniswapV3Pool from state file`);
      const uniswapPoolContract = new ethers.Contract(
        stateFromFile.address,
        uniswapPoolContractDescription.abi,
        this.provider
      );
      return {
        address: stateFromFile.address,
        txHash: stateFromFile.txHash,
        contract: uniswapPoolContract,
      };
    }

    const uniswapFactoryContractDescription = this.readUniswapCoreInterface('IUniswapV3Factory');
    const uniswapFactoryContract = new ethers.Contract(
      uniswapFactory.toString(),
      uniswapFactoryContractDescription.abi,
      this.signer
    );

    let uniswapPoolAddress = EthAddress.parse(
      await uniswapFactoryContract.getPool(
        config.token0.address.toString(),
        config.token1.address.toString(),
        MarginlyDeployer.toUniswapFee(config.fee)
      )
    );
    let creationTxHash: string | undefined = undefined;

    if (uniswapPoolAddress.isZero()) {
      if (!config.allowCreate) {
        throw new Error(`Pool with id '${config.id} not found`);
      }

      this.logger.log('Uniswap pool not found. Creating new one');
      const tx = await uniswapFactoryContract.createPool(
        config.token0.address.toString(),
        config.token1.address.toString(),
        MarginlyDeployer.toUniswapFee(config.fee),
        this.ethArgs
      );
      await tx.wait();
      uniswapPoolAddress = await this.getCreatedUniswapPoolAddress(
        uniswapFactoryContract,
        tx.hash,
        config.token0.address,
        config.token1.address,
        config.fee
      );

      creationTxHash = tx.hash;
    }

    if (config.assertAddress !== undefined) {
      if (config.assertAddress.compare(uniswapPoolAddress) !== 0) {
        throw new Error(
          `Uniswap pool with id '${
            config.id
          }' has address ${uniswapPoolAddress.toString()}. But it expected to be ${config.assertAddress.toString()}`
        );
      }
    }

    this.stateStore.setById(stateFileId, {
      address: uniswapPoolAddress.toString(),
      txHash: creationTxHash,
    });

    const uniswapPoolContract = new ethers.Contract(
      uniswapPoolAddress.toString(),
      uniswapPoolContractDescription.abi,
      this.provider
    );

    return {
      address: uniswapPoolAddress.toString(),
      txHash: creationTxHash,
      contract: uniswapPoolContract,
    };
  }

  private async getCreatedMarginlyPoolAddress(
    marginlyFactoryContract: ethers.Contract,
    txHash: string,
    quoteToken: EthAddress,
    baseToken: EthAddress
  ): Promise<EthAddress> {
    const txReceipt = await this.provider.getTransactionReceipt(txHash);
    const eventFilter = marginlyFactoryContract.filters.PoolCreated(quoteToken.toString(), baseToken.toString());
    const events = await marginlyFactoryContract.queryFilter(eventFilter, txReceipt.blockHash);

    if (events.length === 0) {
      throw new Error('PoolCreated event not found');
    }
    if (events.length > 1) {
      throw new Error('Multiple PoolCreated events found');
    }
    const event = events[0];
    if (event.args === undefined) {
      throw new Error('PoolCreated event args are undefined');
    }

    const poolAddress = event.args[4];

    return EthAddress.parse(poolAddress);
  }

  public async getOrCreateMarginlyPool(
    marginlyPoolFactoryContract: Contract,
    config: MarginlyConfigMarginlyPool
  ): Promise<LimitedDeployResult> {
    const stateFileId = `marginlyPool_${config.id}`;
    const marginlyPoolContractDescription = this.readMarginlyContract('MarginlyPool');

    const stateFromFile = this.stateStore.getById(stateFileId);
    if (stateFromFile !== undefined) {
      this.logger.log(`Import MarginlyPool from state file`);
      const marginlyPoolContract = new ethers.Contract(
        stateFromFile.address,
        marginlyPoolContractDescription.abi,
        this.provider
      );
      return {
        address: stateFromFile.address,
        txHash: stateFromFile.txHash,
        contract: marginlyPoolContract,
      };
    }

    let marginlyPoolAddress = EthAddress.parse(
      await marginlyPoolFactoryContract.getPool(
        config.quoteToken.address.toString(),
        config.baseToken.address.toString(),
        MarginlyDeployer.toUniswapFee(config.uniswapPool.fee)
      )
    );
    let creationTxHash: string | undefined = undefined;

    if (marginlyPoolAddress.isZero()) {
      this.logger.log('Marginly pool not found. Creating new one');
      const one = BigNumber.from(1e6);
      const baseDecimals = await this.getErc20Decimals(config.baseToken.address);
      const baseOne = BigNumber.from(10).pow(baseDecimals);
      const quoteDecimals = await this.getErc20Decimals(config.quoteToken.address);
      const quoteOne = BigNumber.from(10).pow(quoteDecimals);
      const params = {
        interestRate: config.params.interestRate.mul(one).toInteger(),
        maxLeverage: config.params.maxLeverage.toInteger(),
        recoveryMaxLeverage: config.params.recoveryMaxLeverage.toInteger(),
        swapFee: config.params.swapFee.mul(one).toInteger(),
        priceSecondsAgo: config.params.priceAgo.toSeconds(),
        positionSlippage: config.params.positionSlippage.mul(one).toInteger(),
        mcSlippage: config.params.mcSlippage.mul(one).toInteger(),
        positionMinAmount: config.params.positionMinAmount.mul(baseOne).toInteger(),
        baseLimit: config.params.baseLimit.mul(baseOne).toInteger(),
        quoteLimit: config.params.quoteLimit.mul(quoteOne).toInteger(),
      };
      const tx = await marginlyPoolFactoryContract.createPool(
        config.quoteToken.address.toString(),
        config.baseToken.address.toString(),
        MarginlyDeployer.toUniswapFee(config.uniswapPool.fee),
        params,
        this.ethArgs
      );
      await tx.wait();
      marginlyPoolAddress = await this.getCreatedMarginlyPoolAddress(
        marginlyPoolFactoryContract,
        tx.hash,
        config.quoteToken.address,
        config.baseToken.address
      );
      creationTxHash = tx.hash;
    }

    this.stateStore.setById(stateFileId, {
      address: marginlyPoolAddress.toString(),
      txHash: creationTxHash,
    });

    const marginlyPoolContract = new ethers.Contract(
      marginlyPoolAddress.toString(),
      marginlyPoolContractDescription.abi,
      this.signer
    );

    return {
      address: marginlyPoolAddress.toString(),
      txHash: creationTxHash,
      contract: marginlyPoolContract,
    };
  }

  public async getErc20Symbol(tokenAddress: EthAddress): Promise<string> {
    const tokenContractDescription = this.readOpenzeppelin('IERC20Metadata');
    const tokenContract = new ethers.Contract(tokenAddress.toString(), tokenContractDescription.abi, this.provider);

    return await tokenContract.symbol();
  }

  public async getErc20Decimals(tokenAddress: EthAddress): Promise<number> {
    const tokenContractDescription = this.readOpenzeppelin('IERC20Metadata');
    const tokenContract = new ethers.Contract(tokenAddress.toString(), tokenContractDescription.abi, this.provider);

    return await tokenContract.decimals();
  }
}

class TimeSpan {
  private static readonly regex: RegExp = /^(\d+) (min|sec)$/;
  private readonly value: BigNumber;
  private readonly measure: 'min' | 'sec';

  private constructor(value: BigNumber, measure: 'min' | 'sec') {
    this.value = value;
    this.measure = measure;
  }

  public static parse(str: string): TimeSpan {
    const match = str.match(this.regex);

    if (match === null) {
      throw new Error(`Error parsing time span from string '${str}'`);
    }

    const valueStr = match[1];
    const measureStr = match[2];

    let measure: 'min' | 'sec';
    switch (measureStr) {
      case 'min':
      case 'sec':
        measure = measureStr;
        break;
      default:
        throw new Error(`Unknown measure '${measureStr} in time span '${str}'`);
    }

    return new TimeSpan(BigNumber.from(valueStr), measure);
  }

  public toSeconds(): BigNumber {
    if (this.measure === 'min') {
      return this.value.mul(60);
    } else if (this.measure === 'sec') {
      return this.value;
    } else {
      throw new Error(`Unknown measure '${this.measure}'`);
    }
  }
}

interface MarginlyConfigToken {
  id: string;
  address: EthAddress;
  assertSymbol?: string;
  assertDecimals?: number;
}

interface MarginlyConfigUniswapPool {
  id: string;
  token0: MarginlyConfigToken;
  token1: MarginlyConfigToken;
  fee: RationalNumber;
  allowCreate: boolean;
  assertAddress?: EthAddress;
}

interface MarginlyConfigUniswap {
  factory: EthAddress;
  swapRouter: EthAddress;
}

interface MarginlyFactoryConfig {
  feeHolder: EthAddress;
}

interface MarginlyPoolParams {
  interestRate: RationalNumber;
  maxLeverage: RationalNumber;
  recoveryMaxLeverage: RationalNumber;
  swapFee: RationalNumber;
  priceAgo: TimeSpan;
  positionSlippage: RationalNumber;
  mcSlippage: RationalNumber;
  positionMinAmount: RationalNumber;
  baseLimit: RationalNumber;
  quoteLimit: RationalNumber;
}

interface MarginlyConfigMarginlyPool {
  id: string;
  uniswapPool: MarginlyConfigUniswapPool;
  baseToken: MarginlyConfigToken;
  quoteToken: MarginlyConfigToken;
  params: MarginlyPoolParams;
}

class StrictMarginlyDeployConfig {
  public readonly connection: EthConnectionConfig;
  public readonly uniswap: MarginlyConfigUniswap;
  public readonly marginlyFactory: MarginlyFactoryConfig;
  public readonly tokens: MarginlyConfigToken[];
  public readonly uniswapPools: MarginlyConfigUniswapPool[];
  public readonly marginlyPools: MarginlyConfigMarginlyPool[];

  private constructor(
    connection: EthConnectionConfig,
    uniswap: MarginlyConfigUniswap,
    marginlyFactory: MarginlyFactoryConfig,
    tokens: MarginlyConfigToken[],
    uniswapPools: MarginlyConfigUniswapPool[],
    marginlyPools: MarginlyConfigMarginlyPool[]
  ) {
    this.connection = connection;
    this.uniswap = uniswap;
    this.marginlyFactory = marginlyFactory;
    this.tokens = tokens;
    this.uniswapPools = uniswapPools;
    this.marginlyPools = marginlyPools;
  }

  private static parseTokenSide(str: string): 'token0' | 'token1' {
    switch (str) {
      case 'token0':
      case 'token1':
        return str;
      default:
        throw new Error(`Unknown token side '${str}'`);
    }
  }

  public static fromConfig(config: MarginlyDeployConfig): StrictMarginlyDeployConfig {
    const tokens = new Map<string, MarginlyConfigToken>();
    for (let i = 0; i < config.tokens.length; i++) {
      const rawToken = config.tokens[i];

      if (tokens.has(rawToken.id)) {
        throw new Error(`Duplicate token id ${rawToken.id} at index ${i}`);
      }
      tokens.set(rawToken.id, {
        id: rawToken.id,
        address: EthAddress.parse(rawToken.address),
        assertSymbol: rawToken.assertSymbol,
        assertDecimals: rawToken.assertDecimals,
      });
    }
    const uniswapPools = new Map<string, MarginlyConfigUniswapPool>();
    for (let i = 0; i < config.uniswapPools.length; i++) {
      const rawPool = config.uniswapPools[i];

      if (uniswapPools.has(rawPool.id)) {
        throw new Error(`Duplicate uniswap pool id '${rawPool.id} at index ${i}`);
      }
      const token0 = tokens.get(rawPool.token0Id);
      if (token0 === undefined) {
        throw new Error(`Token0 with id '${rawPool.token0Id}' is not found for uniswap pool '${rawPool.id}'`);
      }
      const token1 = tokens.get(rawPool.token1Id);
      if (token1 === undefined) {
        throw new Error(`Token1 with id '${rawPool.token1Id}' is not found for uniswap pool '${rawPool.id}'`);
      }
      const fee = RationalNumber.parsePercent(rawPool.fee);

      uniswapPools.set(rawPool.id, {
        id: rawPool.id,
        token0,
        token1,
        fee,
        allowCreate: rawPool.allowCreate,
        assertAddress: rawPool.assertAddress === undefined ? undefined : EthAddress.parse(rawPool.assertAddress),
      });
    }
    const marginlyPools: MarginlyConfigMarginlyPool[] = [];
    for (let i = 0; i < config.marginlyPools.length; i++) {
      const rawPool = config.marginlyPools[i];

      const uniswapPool = uniswapPools.get(rawPool.uniswapPoolId);
      if (uniswapPool === undefined) {
        throw new Error(`Can not find uniswap pool '${rawPool.uniswapPoolId} for marginly pool with index ${i}`);
      }
      const baseTokenSide = this.parseTokenSide(rawPool.baseToken);
      const quoteTokenSide = this.parseTokenSide(rawPool.quoteToken);
      if (baseTokenSide === quoteTokenSide) {
        throw new Error(`Base token and quote token are same for marginly pool with index ${i}`);
      }
      const baseToken = uniswapPool[baseTokenSide];
      const quoteToken = uniswapPool[quoteTokenSide];

      const params: MarginlyPoolParams = {
        interestRate: RationalNumber.parsePercent(rawPool.params.interestRate),
        maxLeverage: RationalNumber.parse(rawPool.params.maxLeverage),
        recoveryMaxLeverage: RationalNumber.parse(rawPool.params.recoveryMaxLeverage),
        swapFee: RationalNumber.parsePercent(rawPool.params.swapFee),
        priceAgo: TimeSpan.parse(rawPool.params.priceAgo),
        positionSlippage: RationalNumber.parsePercent(rawPool.params.positionSlippage),
        mcSlippage: RationalNumber.parsePercent(rawPool.params.mcSlippage),
        positionMinAmount: RationalNumber.parse(rawPool.params.positionMinAmount),
        baseLimit: RationalNumber.parse(rawPool.params.baseLimit),
        quoteLimit: RationalNumber.parse(rawPool.params.quoteLimit),
      };
      marginlyPools.push({
        id: rawPool.id,
        uniswapPool,
        baseToken,
        quoteToken,
        params,
      });
    }
    return new StrictMarginlyDeployConfig(
      config.connection,
      {
        swapRouter: EthAddress.parse(config.uniswap.swapRouter),
        factory: EthAddress.parse(config.uniswap.factory),
      },
      {
        feeHolder: EthAddress.parse(config.marginlyFactory.feeHolder),
      },
      Array.from(tokens.values()),
      Array.from(uniswapPools.values()),
      marginlyPools
    );
  }
}

interface MarginlyDeploymentMarginlyPool {
  id: string;
  address: string;
}

export interface MarginlyDeployment {
  marginlyPools: MarginlyDeploymentMarginlyPool[];
}

export function mergeMarginlyDeployments(
  oldDeployment: MarginlyDeployment,
  newDeployment: MarginlyDeployment
): MarginlyDeployment {
  function assertNoDuplicates(label: string, deployment: MarginlyDeployment) {
    const poolSet = new Set<string>();
    for (const marginlyPool of deployment.marginlyPools) {
      if (poolSet.has(marginlyPool.id)) {
        throw new Error(`Duplicate id of marginly pool '${marginlyPool.id}' in ${label}`);
      }
      poolSet.add(marginlyPool.id);
    }
  }

  assertNoDuplicates('old deployment', oldDeployment);
  assertNoDuplicates('new deployment', newDeployment);

  const mergedDeployment = {
    marginlyPools: [...oldDeployment.marginlyPools],
  };

  for (const marginlyPool of newDeployment.marginlyPools) {
    const index = mergedDeployment.marginlyPools.findIndex((x) => x.id === marginlyPool.id);
    if (index !== -1) {
      mergedDeployment.marginlyPools.splice(index, 1);
    }
    mergedDeployment.marginlyPools.push(marginlyPool);
  }

  mergedDeployment.marginlyPools.sort((a, b) => {
    if (a.id < b.id) {
      return -1;
    } else if (a.id === b.id) {
      return 0;
    } else {
      return 1;
    }
  });

  return mergedDeployment;
}

export interface MarginlyDeployBundle {
  name: string;
  config: MarginlyDeployConfig;
  deployment?: MarginlyDeployment;
}

export async function getMarginlyDeployBundles(logger: Logger): Promise<MarginlyDeployBundle[]> {
  const dirs = require('./data/deploy/index.json');

  const result: MarginlyDeployBundle[] = [];

  for (const dir of dirs) {
    const config: MarginlyDeployConfig = require(`./data/deploy/${dir}/config.json`);
    let deployment: MarginlyDeployment | undefined;

    try {
      deployment = require(`./data/deploy/${dir}/deployment.json`);
    } catch (err) {
      logger.log(`Deployment file for ${dir} deployment is not found`);
    }

    result.push({
      name: dir,
      config,
      deployment,
    });
  }

  return result;
}

export async function deployMarginly(
  signer: ethers.Signer,
  rawConfig: MarginlyDeployConfig,
  stateStore: StateStore,
  logger: Logger
): Promise<MarginlyDeployment> {
  const { config, marginlyDeployer } = await using(logger.beginScope('Initialize'), async () => {
    if (signer.provider === undefined) {
      throw new Error('Provider is required');
    }

    const provider = signer.provider;

    const config = StrictMarginlyDeployConfig.fromConfig(rawConfig);

    if (config.connection.assertChainId !== undefined) {
      const expectedChainId = config.connection.assertChainId;
      const { chainId: actualChainId } = await provider.getNetwork();
      if (actualChainId !== expectedChainId) {
        throw new Error(`Wrong chain id ${actualChainId}. Expected to be ${expectedChainId}`);
      }
    }

    const marginlyDeployer = new MarginlyDeployer(signer, config.connection.ethOptions, stateStore, logger);

    return { config, marginlyDeployer };
  });

  await using(logger.beginScope('Check tokens'), async () => {
    for (const token of config.tokens) {
      if (token.assertSymbol !== undefined) {
        const expectedSymbol = token.assertSymbol;
        const actualSymbol = await marginlyDeployer.getErc20Symbol(token.address);
        if (actualSymbol !== expectedSymbol) {
          throw new Error(
            `Invalid symbol '${actualSymbol}' for token with id '${token.id}. Expected symbol: '${expectedSymbol}'`
          );
        }
      }
      if (token.assertDecimals !== undefined) {
        const expectedDecimals = token.assertDecimals;
        const actualDecimals = await marginlyDeployer.getErc20Decimals(token.address);
        if (actualDecimals !== expectedDecimals) {
          throw new Error(
            `Invalid decimals '${actualDecimals}' for token with id '${token.id}'. Expected decimals: '${expectedDecimals}'`
          );
        }
      }
    }
  });

  const marginlyPoolImplDeployResult = await using(
    logger.beginScope('Deploy marginly pool implementation'),
    async () => {
      const marginlyPoolImplDeployResult = await marginlyDeployer.deployMarginlyPoolImplementation();
      printDeployState('Marginly pool implementation', marginlyPoolImplDeployResult, logger);

      return marginlyPoolImplDeployResult;
    }
  );

  const marginlyFactoryDeployResult = await using(logger.beginScope('Deploy marginly factory'), async () => {
    const marginlyFactoryDeployResult = await marginlyDeployer.deployMarginlyFactory(
      EthAddress.parse(marginlyPoolImplDeployResult.contract.address),
      config.uniswap.factory,
      config.uniswap.swapRouter,
      config.marginlyFactory.feeHolder
    );
    printDeployState('Marginly Factory', marginlyFactoryDeployResult, logger);

    return marginlyFactoryDeployResult;
  });

  await using(logger.beginScope('Create uniswap pools'), async () => {
    const uniswapPoolDeploymentResults = new Map<string, LimitedDeployResult>();
    for (const pool of config.uniswapPools) {
      const uniswapPoolDeploymentResult = await marginlyDeployer.getOrCreateUniswapPool(config.uniswap.factory, pool);
      uniswapPoolDeploymentResults.set(pool.id, uniswapPoolDeploymentResult);
      printDeployState(`Uniswap Pool '${pool.id}'`, uniswapPoolDeploymentResult, logger);
    }
  });

  const deployedMarginlyPools = await using(logger.beginScope('Create marginly pools'), async () => {
    const deployedMarginlyPools: MarginlyDeploymentMarginlyPool[] = [];
    for (const pool of config.marginlyPools) {
      const marginlyPoolDeploymentResult = await marginlyDeployer.getOrCreateMarginlyPool(
        marginlyFactoryDeployResult.contract,
        pool
      );
      deployedMarginlyPools.push({
        id: pool.id,
        address: marginlyPoolDeploymentResult.address,
      });
      printDeployState(`Marginly Pool '${pool.id}'`, marginlyPoolDeploymentResult, logger);
    }
    return deployedMarginlyPools;
  });

  return {
    marginlyPools: deployedMarginlyPools,
  };
}
