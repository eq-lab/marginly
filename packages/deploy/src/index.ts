import * as ethers from 'ethers';
import { Contract, ContractFactory, Signer } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { ContractDescription, ContractReader, EthAddress, RationalNumber } from '@marginly/common';
import {
  EthConnectionConfig,
  EthOptions,
  isMarginlyDeployConfigExistingToken,
  isMarginlyDeployConfigMintableToken,
  isMarginlyDeployConfigUniswapGenuine,
  isMarginlyDeployConfigUniswapMock, isMarginlyDeployConfigWethToken,
  MarginlyDeployConfig,
} from './config';
import { createPriceGetter } from '@marginly/common/price';
import { priceToPriceFp18, priceToSqrtPriceX96, sortUniswapPoolTokens } from '@marginly/common/math';
import { timeoutRetry } from '@marginly/common/execution';
import { CriticalError } from '@marginly/common/error';
import { createRootLogger, LogFormatter, LogRecordBase, textFormatter } from '@marginly/logger';
import { Provider, Wallet } from 'zksync-web3';
import { createDeployer } from './zksync';

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

function adapterWriter(logger: Logger, format: LogFormatter) {
  return (logRecord: { eql: LogRecordBase & Record<string, unknown> }): void => {
    logger.log(format(logRecord));
  }
}

function readOpenzeppelinContract(name: string): ContractDescription {
  return require(`@openzeppelin/contracts/build/contracts/${name}.json`);
}

function readUniswapMockContract(name: string): ContractDescription {
  return require(`@marginly/contracts-uniswap-mock/artifacts/contracts/${name}.sol/${name}.json`);
}

interface TokenInfo {
  address: EthAddress;
  decimals: number,
  symbol: string
}

class TokenRepository {
  private readonly provider;
  private readonly marginlyDeployer;
  private readonly tokens;

  public constructor(provider: ethers.providers.Provider, marginlyDeployer: MarginlyDeployer) {
    this.provider = provider;
    this.marginlyDeployer = marginlyDeployer;
    this.tokens = new Map<string, TokenInfo>();
  }

  public async materializeToken(token: MarginlyConfigToken): Promise<void> {
    if (this.tokens.has(token.id)) {
      throw new Error(`Token with id ${token.id} already materialized`);
    }

    let tokenAddress: EthAddress;
    let tokenDecimals: number;
    let tokenSymbol: string;

    if (isMarginlyConfigExistingToken(token)) {
      const tokenContractDescription = readOpenzeppelinContract('IERC20Metadata');
      const tokenContract = new ethers.Contract(token.address.toString(), tokenContractDescription.abi, this.provider);
      const actualSymbol = await tokenContract.symbol();
      const actualDecimals = await tokenContract.decimals();

      if (token.assertSymbol !== undefined) {
        const expectedSymbol = token.assertSymbol;
        if (actualSymbol !== expectedSymbol) {
          throw new Error(
            `Invalid symbol '${actualSymbol}' for token with id '${token.id}. Expected symbol: '${expectedSymbol}'`,
          );
        }
      }
      if (token.assertDecimals !== undefined) {
        const expectedDecimals = token.assertDecimals;
        if (actualDecimals !== expectedDecimals) {
          throw new Error(
            `Invalid decimals '${actualDecimals}' for token with id '${token.id}'. Expected decimals: '${expectedDecimals}'`,
          );
        }
      }
      tokenAddress = token.address;
      tokenSymbol = actualSymbol;
      tokenDecimals = actualDecimals;
    } else if (isMarginlyConfigMintableToken(token)) {
      const deployResult = await this.marginlyDeployer.deployMintableToken(token.name, token.symbol, token.decimals);
      tokenAddress = EthAddress.parse(deployResult.address);
      tokenSymbol = await deployResult.contract.symbol();
      tokenDecimals = await deployResult.contract.decimals();
    } else if (isMarginlyConfigWethToken(token)) {
      const deployResult = await this.marginlyDeployer.deployWethToken();
      tokenAddress = EthAddress.parse(deployResult.address);
      tokenSymbol = await deployResult.contract.symbol();
      tokenDecimals = await deployResult.contract.decimals();
    } else {
      throw new Error('Unknown token type');
    }

    this.tokens.set(token.id, {
      address: tokenAddress,
      symbol: tokenSymbol,
      decimals: tokenDecimals,
    });
  }

  public getTokenInfo(tokenId: string): TokenInfo {
    const tokenInfo = this.tokens.get(tokenId);
    if (tokenInfo === undefined) {
      throw new Error(`Unknown token ${tokenId}`);
    }
    return tokenInfo;
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

function createMarginlyMockContractReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@marginly/contracts/artifacts/contracts/test/${name}.sol/${name}.json`);
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

function createAaveContractReader(): ContractReader {
  return (name: string): ContractDescription => {
    return require(`@aave/core-v3/artifacts/contracts/interfaces/${name}.sol/${name}.json`);
  };
}

interface LimitedDeployResult extends DeployState {
  contract: Contract;
}

interface DeployResult extends DeployState {
  factory: {
    deploy(...args: any[]): Promise<Contract>;
    attach(address: string): Contract;
  };
  contract: Contract;
}

const deployTemplate = (
  signer: Wallet,
  ethArgs: EthOptions,
  contractReader: (name: string) => ContractDescription,
  stateStore: StateStore,
  logger: Logger
) => {
  return async (
    name: string,
    args: unknown[],
    id: string,
    contractReaderOverride: (name: string) => ContractDescription = contractReader
  ): Promise<DeployResult> => {
    const deployer = createDeployer(signer);
    const contractDescription = await deployer.loadArtifact(name);
    const factory = {
      deploy: async (...args: any[]): Promise<Contract> => {
        return await deployer.deploy(contractDescription, args);
      },
      attach: (address: string): Contract => {
        return new Contract(address, contractDescription.abi, signer.ethWallet());
      }
    };

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

    const contract = await factory.deploy(...args);
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
  private readonly readAaveContract;
  private readonly readMarginlyMockContract;
  private readonly deploy;
  private readonly signer;
  private readonly ethArgs;
  private readonly provider;
  private readonly stateStore;
  private readonly logger;

  public constructor(signer: Wallet, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    this.readMarginlyContract = createMarginlyContractReader();
    this.readUniswapCoreInterface = createUniswapV3CoreInterfacesReader();
    this.readOpenzeppelin = createOpenzeppelinContractReader();
    this.readAaveContract = createAaveContractReader();
    this.readMarginlyMockContract = createMarginlyMockContractReader();
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
    feeHolder: EthAddress,
    weth9: MarginlyConfigToken,
    tokenRepository: TokenRepository
  ): Promise<DeployResult> {
    const { address: weth9Address } = tokenRepository.getTokenInfo(weth9.id);
    return this.deploy(
      'MarginlyFactory',
      [
        marginlyPoolImplementation.toString(),
        uniswapFactory.toString(),
        swapRouter.toString(),
        feeHolder.toString(),
        weth9Address.toString(),
      ],
      'marginlyFactory'
    );
  }

  public deployMarginlyKeeper(aavePoolAddressesProvider: EthAddress): Promise<DeployResult> {
    return this.deploy('MarginlyKeeper', [aavePoolAddressesProvider.toString()], 'marginlyKeeper');
  }

  public static toUniswapFee(fee: RationalNumber): BigNumber {
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

  public async getOrCreateUniswapPoolGenuine(
    uniswapFactory: EthAddress,
    config: MarginlyConfigUniswapPoolGenuine,
    tokenRepository: TokenRepository,
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

    const tokenAAddress = tokenRepository.getTokenInfo(config.tokenA.id).address;
    const tokenBAddress = tokenRepository.getTokenInfo(config.tokenB.id).address;

    const [
      token0Address,
      token1Address,
    ] = sortUniswapPoolTokens([tokenAAddress.toString(), tokenBAddress.toString()], [tokenAAddress, tokenBAddress]);

    let uniswapPoolAddress = EthAddress.parse(
      await uniswapFactoryContract.getPool(
        token0Address.toString(),
        token1Address.toString(),
        MarginlyDeployer.toUniswapFee(config.fee),
      ),
    );
    let creationTxHash: string | undefined = undefined;

    if (uniswapPoolAddress.isZero()) {
      if (!config.allowCreate) {
        throw new Error(`Pool with id '${config.id} not found`);
      }

      this.logger.log('Uniswap pool not found. Creating new one');
      const tx = await uniswapFactoryContract.createPool(
        token0Address.toString(),
        token1Address.toString(),
        MarginlyDeployer.toUniswapFee(config.fee),
        this.ethArgs
      );
      await tx.wait();
      uniswapPoolAddress = await this.getCreatedUniswapPoolAddress(
        uniswapFactoryContract,
        tx.hash,
        token0Address,
        token1Address,
        config.fee,
      );

      creationTxHash = tx.hash;
    }

    if (config.assertAddress !== undefined) {
      if (config.assertAddress.compare(uniswapPoolAddress) !== 0) {
        throw new Error(
          `Uniswap pool with id '${
            config.id
          }' has address ${uniswapPoolAddress.toString()}. But it expected to be ${config.assertAddress.toString()}`,
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
      this.provider,
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
    baseToken: EthAddress,
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
    config: MarginlyConfigMarginlyPool,
    tokenRepository: TokenRepository,
  ): Promise<LimitedDeployResult> {
    const stateFileId = `marginlyPool_${config.id}`;
    const marginlyPoolContractDescription = this.readMarginlyContract('MarginlyPool');

    const stateFromFile = this.stateStore.getById(stateFileId);
    if (stateFromFile !== undefined) {
      this.logger.log(`Import MarginlyPool from state file`);
      const marginlyPoolContract = new ethers.Contract(
        stateFromFile.address,
        marginlyPoolContractDescription.abi,
        this.provider,
      );
      return {
        address: stateFromFile.address,
        txHash: stateFromFile.txHash,
        contract: marginlyPoolContract,
      };
    }

    const quoteTokenInfo = tokenRepository.getTokenInfo(config.quoteToken.id);
    const baseTokenInfo = tokenRepository.getTokenInfo(config.baseToken.id);
    let marginlyPoolAddress = EthAddress.parse(
      await marginlyPoolFactoryContract.getPool(
        quoteTokenInfo.address.toString(),
        baseTokenInfo.address.toString(),
        MarginlyDeployer.toUniswapFee(config.uniswapPool.fee),
      ),
    );
    let creationTxHash: string | undefined = undefined;

    if (marginlyPoolAddress.isZero()) {
      this.logger.log('Marginly pool not found. Creating new one');
      const one = BigNumber.from(1e6);
      const baseOne = BigNumber.from(10).pow(baseTokenInfo.decimals);
      const quoteOne = BigNumber.from(10).pow(quoteTokenInfo.decimals);
      const params = {
        interestRate: config.params.interestRate.mul(one).toInteger(),
        maxLeverage: config.params.maxLeverage.toInteger(),
        swapFee: config.params.swapFee.mul(one).toInteger(),
        priceSecondsAgo: config.params.priceAgo.toSeconds(),
        positionSlippage: config.params.positionSlippage.mul(one).toInteger(),
        mcSlippage: config.params.mcSlippage.mul(one).toInteger(),
        positionMinAmount: config.params.positionMinAmount.mul(baseOne).toInteger(),
        baseLimit: config.params.baseLimit.mul(baseOne).toInteger(),
        quoteLimit: config.params.quoteLimit.mul(quoteOne).toInteger(),
      };
      const tx = await marginlyPoolFactoryContract.createPool(
        quoteTokenInfo.address.toString(),
        baseTokenInfo.address.toString(),
        MarginlyDeployer.toUniswapFee(config.uniswapPool.fee),
        params,
        this.ethArgs,
      );
      await tx.wait();

      marginlyPoolAddress = EthAddress.parse(
        await marginlyPoolFactoryContract.getPool(
          quoteTokenInfo.address.toString(),
          baseTokenInfo.address.toString(),
          MarginlyDeployer.toUniswapFee(config.uniswapPool.fee),
        ),
      );

      if (marginlyPoolAddress.isZero()) {
        throw new Error('Marginly pool creation failed');
      }
    }

    this.stateStore.setById(stateFileId, {
      address: marginlyPoolAddress.toString(),
      txHash: creationTxHash,
    });

    const marginlyPoolContract = new ethers.Contract(
      marginlyPoolAddress.toString(),
      marginlyPoolContractDescription.abi,
      this.signer,
    );

    return {
      address: marginlyPoolAddress.toString(),
      txHash: creationTxHash,
      contract: marginlyPoolContract,
    };
  }

  public async getOrCreateMockAavePool(): Promise<LimitedDeployResult> {
    const stateFileId = `mockAavePool`;
    const mockAavePoolContractDescription = this.readMarginlyMockContract('MockAavePool');

    const stateFromFile = this.stateStore.getById(stateFileId);
    if (stateFromFile !== undefined) {
      this.logger.log(`Import MockAavePool from state file`);

      const mockAavePoolContract = new ethers.Contract(
        stateFromFile.address,
        mockAavePoolContractDescription.abi,
        this.provider,
      );

      return {
        address: stateFromFile.address,
        txHash: stateFromFile.txHash,
        contract: mockAavePoolContract,
      };
    }

    return await this.deploy('MockAavePool', [], 'mockAavePool', this.readMarginlyMockContract);
  }

  public async getOrCreateMockAavePoolAddressesProvider(aavePoolAddress: EthAddress): Promise<LimitedDeployResult> {
    const stateFileId = `mockAavePoolAddressesProvider`;
    const mockAavePoolAddressesProviderContractDescription = this.readMarginlyMockContract(
      'MockAavePoolAddressesProvider',
    );

    const stateFromFile = this.stateStore.getById(stateFileId);
    if (stateFromFile !== undefined) {
      this.logger.log(`Import MockAavePool from state file`);

      const mockAavePoolAddressesProviderContract = new ethers.Contract(
        stateFromFile.address,
        mockAavePoolAddressesProviderContractDescription.abi,
        this.provider,
      );

      return {
        address: stateFromFile.address,
        txHash: stateFromFile.txHash,
        contract: mockAavePoolAddressesProviderContract,
      };
    }

    return await this.deploy(
      'MockAavePoolAddressesProvider',
      [aavePoolAddress.toString()],
      'mockAavePoolAddressesProvider',
      this.readMarginlyMockContract,
    );
  }

  public getAavePoolAddressesProvider(address: EthAddress): ethers.Contract {
    const aavePoolAddressesProviderContractDescription = this.readAaveContract('IPoolAddressesProvider');
    return new ethers.Contract(address.toString(), aavePoolAddressesProviderContractDescription.abi, this.signer);
  }

  public deployMintableToken(name: string, symbol: string, decimals: number): Promise<DeployResult> {
    return this.deploy('MintableToken', [name, symbol, decimals], `token_${symbol}`, readUniswapMockContract);
  }

  public deployWethToken(): Promise<DeployResult> {
    return this.deploy('WETH9', [], `token_weth`, readUniswapMockContract);
  }

  public async deployUniswapRouterMock(
    weth9: MarginlyConfigToken,
    tokenRepository: TokenRepository,
  ): Promise<DeployResult> {
    const { address } = tokenRepository.getTokenInfo(weth9.id);
    return this.deploy('SwapRouterMock', [address.toString()], 'swapRouterMock', readUniswapMockContract);
  }

  public async deployUniswapPoolMock(
    oracle: EthAddress,
    poolConfig: MarginlyConfigUniswapPoolMock,
    tokenRepository: TokenRepository,
  ): Promise<DeployResult> {
    const { address: tokenAAddress } = tokenRepository.getTokenInfo(poolConfig.tokenA.id);
    const { address: tokenBAddress } = tokenRepository.getTokenInfo(poolConfig.tokenB.id);
    return this.deploy(
      'UniswapV3PoolMock',
      [oracle.toString(), tokenAAddress.toString(), tokenBAddress.toString(), MarginlyDeployer.toUniswapFee(poolConfig.fee)],
      `uniswapV3PoolMock_${poolConfig.id}`, readUniswapMockContract,
    );
  }

  public async ensureTokenAmount(token: MarginlyConfigToken, ethAddress: EthAddress, amount: RationalNumber, tokenRepository: TokenRepository): Promise<void> {
    if (isMarginlyConfigMintableToken(token)) {
      const tokenInfo = tokenRepository.getTokenInfo(token.id);
      const tokenContractDescription = readUniswapMockContract('MintableToken');
      const tokenContract = new ethers.Contract(tokenInfo.address.toString(), tokenContractDescription.abi, this.signer);
      const one = BigNumber.from(10).pow(tokenInfo.decimals);

      const desiredBalance = amount.mul(one).toInteger();
      const currentBalance: BigNumber = await tokenContract.balanceOf(ethAddress.toString());

      if (currentBalance.lt(desiredBalance)) {
        await (await tokenContract.mint(ethAddress.toString(), desiredBalance.sub(currentBalance))).wait();
      }
    } else {
      throw new Error(`Unable to set balance for token ${token.id}`);
    }
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

interface MarginlyConfigExisingToken {
  type: 'existing';
  id: string;
  address: EthAddress;
  assertSymbol?: string;
  assertDecimals?: number;
}

interface MarginlyConfigMintableToken {
  type: 'mintable';
  id: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface MarginlyConfigWethToken {
  type: 'weth';
  id: string;
}

type MarginlyConfigToken = MarginlyConfigExisingToken | MarginlyConfigMintableToken | MarginlyConfigWethToken;

function isMarginlyConfigExistingToken(token: MarginlyConfigToken): token is MarginlyConfigExisingToken {
  return token.type === 'existing';
}

function isMarginlyConfigMintableToken(token: MarginlyConfigToken): token is MarginlyConfigMintableToken {
  return token.type === 'mintable';
}

function isMarginlyConfigWethToken(token: MarginlyConfigToken): token is MarginlyConfigWethToken {
  return token.type === 'weth';
}

interface MarginlyConfigUniswapPoolGenuine {
  type: 'genuine';
  id: string;
  tokenA: MarginlyConfigToken;
  tokenB: MarginlyConfigToken;
  fee: RationalNumber;
  allowCreate: boolean;
  assertAddress?: EthAddress;
}

interface MarginlyConfigUniswapGenuine {
  type: 'genuine';
  factory: EthAddress;
  swapRouter: EthAddress;
  pools: MarginlyConfigUniswapPoolGenuine[];
}

interface MarginlyConfigUniswapPoolMock {
  type: 'mock';
  id: string;
  tokenA: MarginlyConfigToken;
  tokenB: MarginlyConfigToken;
  fee: RationalNumber;
  tokenABalance?: RationalNumber;
  tokenBBalance?: RationalNumber;
  priceId: string;
  price: number;
  priceBaseTokenKey: 'tokenA' | 'tokenB';
}

interface MarginlyConfigUniswapMock {
  type: 'mock';
  oracle: EthAddress;
  weth9Token: MarginlyConfigToken;
  priceLogSize: number;
  pools: MarginlyConfigUniswapPoolMock[];
}

type MarginlyConfigUniswap = MarginlyConfigUniswapGenuine | MarginlyConfigUniswapMock;

function isMarginlyConfigUniswapGenuine(uniswap: MarginlyConfigUniswap): uniswap is MarginlyConfigUniswapGenuine {
  return uniswap.type === 'genuine';
}

function isMarginlyConfigUniswapMock(uniswap: MarginlyConfigUniswap): uniswap is MarginlyConfigUniswapMock {
  return uniswap.type === 'mock';
}

type MarginlyConfigUniswapPool = MarginlyConfigUniswapPoolGenuine | MarginlyConfigUniswapPoolMock;

function isMarginlyConfigUniswapPoolGenuine(uniswapPool: MarginlyConfigUniswapPool): uniswapPool is MarginlyConfigUniswapPoolGenuine {
  return uniswapPool.type === 'genuine';
}

function isMarginlyConfigUniswapPoolMock(uniswapPool: MarginlyConfigUniswapPool): uniswapPool is MarginlyConfigUniswapPoolMock {
  return uniswapPool.type === 'mock';
}

interface MarginlyFactoryConfig {
  feeHolder: EthAddress;
  weth9Token: MarginlyConfigToken;
}

interface MarginlyPoolParams {
  interestRate: RationalNumber;
  maxLeverage: RationalNumber;
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

interface MarginlyConfigMarginlyKeeper {
  aavePoolAddressesProvider: {
    address?: EthAddress;
    allowCreateMock?: boolean;
  };
}

class StrictMarginlyDeployConfig {
  public readonly connection: EthConnectionConfig;
  public readonly tokens: MarginlyConfigToken[];
  public readonly uniswap: MarginlyConfigUniswap;
  public readonly marginlyFactory: MarginlyFactoryConfig;
  public readonly marginlyPools: MarginlyConfigMarginlyPool[];
  public readonly marginlyKeeper: MarginlyConfigMarginlyKeeper;

  private constructor(
    connection: EthConnectionConfig,
    uniswap: MarginlyConfigUniswap,
    marginlyFactory: MarginlyFactoryConfig,
    tokens: MarginlyConfigToken[],
    marginlyPools: MarginlyConfigMarginlyPool[],
    marginlyKeeper: MarginlyConfigMarginlyKeeper
  ) {
    this.connection = connection;
    this.uniswap = uniswap;
    this.marginlyFactory = marginlyFactory;
    this.tokens = tokens;
    this.marginlyPools = marginlyPools;
    this.marginlyKeeper = marginlyKeeper;
  }

  public static async fromConfig(logger: Logger, config: MarginlyDeployConfig): Promise<StrictMarginlyDeployConfig> {
    const tokens = new Map<string, MarginlyConfigToken>();
    for (let i = 0; i < config.tokens.length; i++) {
      const rawToken = config.tokens[i];

      if (tokens.has(rawToken.id)) {
        throw new Error(`Duplicate token id ${rawToken.id} at index ${i}`);
      }

      if (isMarginlyDeployConfigExistingToken(rawToken)) {
        const token: MarginlyConfigExisingToken = {
          type: 'existing',
          id: rawToken.id,
          address: EthAddress.parse(rawToken.address),
          assertSymbol: rawToken.assertSymbol,
          assertDecimals: rawToken.assertDecimals,
        };
        tokens.set(rawToken.id, token);
      } else if (isMarginlyDeployConfigMintableToken(rawToken)) {
        const token: MarginlyConfigMintableToken = {
          type: 'mintable',
          id: rawToken.id,
          name: rawToken.name,
          symbol: rawToken.symbol,
          decimals: rawToken.decimals,
        };
        tokens.set(rawToken.id, token);
      } else if (isMarginlyDeployConfigWethToken(rawToken)) {
        const token: MarginlyConfigWethToken = {
          type: 'weth',
          id: rawToken.id
        };
        tokens.set(rawToken.id, token);
      } else {
        throw new Error(`Unknown token type`);
      }
    }

    const prices = new Map<string, number>();

    const priceLogger = createRootLogger('deploy', adapterWriter(logger, textFormatter));
    const executor = timeoutRetry({
      timeout: {
        errorClass: CriticalError,
      },
      retry: {
        errorClass: CriticalError,
        logger: priceLogger,
      },
    });
    for (const rawPrice of config.prices) {
      const priceGetter = createPriceGetter(executor, rawPrice);
      const price = await priceGetter.getPrice(priceLogger);
      prices.set(rawPrice.id, price);
      logger.log(`Price for ${rawPrice.id} is ${price}`);
    }

    let uniswap: MarginlyConfigUniswap;

    const uniswapPools = new Map<string, MarginlyConfigUniswapPool>();

    if (isMarginlyDeployConfigUniswapGenuine(config.uniswap)) {
      const genuinePools: MarginlyConfigUniswapPoolGenuine[] = [];
      for (let i = 0; i < config.uniswap.pools.length; i++) {
        const rawPool = config.uniswap.pools[i];

        if (uniswapPools.has(rawPool.id)) {
          throw new Error(`Duplicate uniswap pool id '${rawPool.id} at index ${i}`);
        }
        const tokenA = tokens.get(rawPool.tokenAId);
        if (tokenA === undefined) {
          throw new Error(`TokenA with id '${rawPool.tokenAId}' is not found for uniswap pool '${rawPool.id}'`);
        }
        const tokenB = tokens.get(rawPool.tokenBId);
        if (tokenB === undefined) {
          throw new Error(`TokenB with id '${rawPool.tokenBId}' is not found for uniswap pool '${rawPool.id}'`);
        }
        const fee = RationalNumber.parsePercent(rawPool.fee);

        const pool: MarginlyConfigUniswapPoolGenuine = {
          type: 'genuine',
          id: rawPool.id,
          tokenA,
          tokenB,
          fee,
          allowCreate: rawPool.allowCreate,
          assertAddress: rawPool.assertAddress === undefined ? undefined : EthAddress.parse(rawPool.assertAddress),
        };
        uniswapPools.set(rawPool.id, pool);
        genuinePools.push(pool);
      }
      uniswap = {
        type: 'genuine',
        swapRouter: EthAddress.parse(config.uniswap.swapRouter),
        factory: EthAddress.parse(config.uniswap.factory),
        pools: genuinePools,
      };
    } else if (isMarginlyDeployConfigUniswapMock(config.uniswap)) {
      const mockPools: MarginlyConfigUniswapPoolMock[] = [];
      for (let i = 0; i < config.uniswap.pools.length; i++) {
        const rawPool = config.uniswap.pools[i];

        if (uniswapPools.has(rawPool.id)) {
          throw new Error(`Duplicate uniswap pool id '${rawPool.id} at index ${i}`);
        }
        const tokenA = tokens.get(rawPool.tokenAId);
        if (tokenA === undefined) {
          throw new Error(`TokenA with id '${rawPool.tokenAId}' is not found for uniswap pool '${rawPool.id}'`);
        }
        const tokenB = tokens.get(rawPool.tokenBId);
        if (tokenB === undefined) {
          throw new Error(`TokenB with id '${rawPool.tokenBId}' is not found for uniswap pool '${rawPool.id}'`);
        }
        const fee = RationalNumber.parsePercent(rawPool.fee);

        const price = prices.get(rawPool.priceId);

        if (price === undefined) {
          throw new Error(`Price with id ${rawPool.priceId} not found`);
        }

        const priceBaseToken = tokens.get(rawPool.priceBaseTokenId);

        if (priceBaseToken === undefined) {
          throw new Error(`Price base token with id ${rawPool.priceBaseTokenId} not found`);
        }

        let priceBaseTokenKey: 'tokenA' | 'tokenB';

        if (priceBaseToken.id === tokenA.id) {
          priceBaseTokenKey = 'tokenA';
        } else if (priceBaseToken.id === tokenB.id) {
          priceBaseTokenKey = 'tokenB';
        } else {
          throw new Error('Price base token must be either tokenA or tokenB');
        }

        const pool: MarginlyConfigUniswapPoolMock = {
          type: 'mock',
          id: rawPool.id,
          tokenA,
          tokenB,
          fee,
          tokenABalance: rawPool.tokenABalance === undefined ? undefined : RationalNumber.parse(rawPool.tokenABalance),
          tokenBBalance: rawPool.tokenBBalance === undefined ? undefined : RationalNumber.parse(rawPool.tokenBBalance),
          priceId: rawPool.priceId,
          price,
          priceBaseTokenKey,
        };
        uniswapPools.set(rawPool.id, pool);
        mockPools.push(pool);
      }

      const weth9Token = tokens.get(config.uniswap.weth9TokenId);

      if (weth9Token === undefined) {
        throw new Error(`WETH9 token with id ${config.uniswap.weth9TokenId} not found`);
      }

      if (config.uniswap.priceLogSize < 1 || config.uniswap.priceLogSize > 65535) {
        throw new Error('Invalid price log size');
      }

      uniswap = {
        type: 'mock',
        oracle: EthAddress.parse(config.uniswap.oracle),
        weth9Token,
        priceLogSize: config.uniswap.priceLogSize,
        pools: mockPools,
      };
    } else {
      throw new Error('Unknown uniswap type');
    }

    const ids = [];

    const marginlyPools: MarginlyConfigMarginlyPool[] = [];
    for (let i = 0; i < config.marginlyPools.length; i++) {
      const rawPool = config.marginlyPools[i];

      const uniswapPool = uniswapPools.get(rawPool.uniswapPoolId);
      if (uniswapPool === undefined) {
        throw new Error(`Can not find uniswap pool '${rawPool.uniswapPoolId}' for marginly pool with index ${i}`);
      }

      const baseToken = tokens.get(rawPool.baseTokenId);
      if (baseToken === undefined) {
        throw new Error(`Base token with id '${rawPool.baseTokenId}' is not found for marginly pool '${rawPool.id}'`);
      }

      if (baseToken.id !== uniswapPool.tokenA.id && baseToken.id !== uniswapPool.tokenB.id) {
        throw new Error(`Base token with id '${baseToken.id}' of marginly pool '${rawPool.id}' not found in uniswap pool '${uniswapPool.id}'`);
      }

      const quoteToken = uniswapPool.tokenA.id === baseToken.id ? uniswapPool.tokenB : uniswapPool.tokenA;

      const params: MarginlyPoolParams = {
        interestRate: RationalNumber.parsePercent(rawPool.params.interestRate),
        maxLeverage: RationalNumber.parse(rawPool.params.maxLeverage),
        swapFee: RationalNumber.parsePercent(rawPool.params.swapFee),
        priceAgo: TimeSpan.parse(rawPool.params.priceAgo),
        positionSlippage: RationalNumber.parsePercent(rawPool.params.positionSlippage),
        mcSlippage: RationalNumber.parsePercent(rawPool.params.mcSlippage),
        positionMinAmount: RationalNumber.parse(rawPool.params.positionMinAmount),
        baseLimit: RationalNumber.parse(rawPool.params.baseLimit),
        quoteLimit: RationalNumber.parse(rawPool.params.quoteLimit),
      };
      ids.push(rawPool.id);
      marginlyPools.push({
        id: rawPool.id,
        uniswapPool,
        baseToken,
        quoteToken,
        params,
      });
    }

    if (
      (config.marginlyKeeper.aavePoolAddressesProvider.address &&
        config.marginlyKeeper.aavePoolAddressesProvider.allowCreateMock) ||
      (!config.marginlyKeeper.aavePoolAddressesProvider.address &&
        !config.marginlyKeeper.aavePoolAddressesProvider.allowCreateMock)
    ) {
      throw new Error(
        `Config error. You should either provide address of aavePoolAddressesProvider or set flag allowCreateMock`,
      );
    }

    const marginlyKeeper: MarginlyConfigMarginlyKeeper = {
      aavePoolAddressesProvider: {
        address: config.marginlyKeeper.aavePoolAddressesProvider.address
          ? EthAddress.parse(config.marginlyKeeper.aavePoolAddressesProvider.address)
          : undefined,
        allowCreateMock: config.marginlyKeeper.aavePoolAddressesProvider.allowCreateMock,
      },
    };

    const wethToken = tokens.get(config.marginlyFactory.wethTokenId);
    if (wethToken === undefined) {
      throw new Error(`Can not find WETH token by tokenId'${config.marginlyFactory.wethTokenId} for marginly factory`);
    }

    return new StrictMarginlyDeployConfig(
      config.connection,
      uniswap,
      {
        feeHolder: EthAddress.parse(config.marginlyFactory.feeHolder),
        weth9Token: wethToken,
      },
      Array.from(tokens.values()),
      marginlyPools,
      marginlyKeeper
    );
  }
}

interface MarginlyDeploymentMarginlyPool {
  id: string;
  address: string;
}

export interface MarginlyDeployment {
  marginlyPools: MarginlyDeploymentMarginlyPool[];
  marginlyKeeper?: { address: string };
}

export function mergeMarginlyDeployments(
  oldDeployment: MarginlyDeployment,
  newDeployment: MarginlyDeployment,
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
    marginlyKeeper: newDeployment.marginlyKeeper,
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

function getMarginlyKeeperAddress(stateStore: StateStore): string | undefined {
  const deployState = stateStore.getById('marginlyKeeper');
  return deployState ? deployState.address : undefined;
}

export async function deployMarginly(
  signer: Wallet,
  rawConfig: MarginlyDeployConfig,
  stateStore: StateStore,
  logger: Logger,
): Promise<MarginlyDeployment> {
  const { config, provider, marginlyDeployer } = await using(logger.beginScope('Initialize'), async () => {
    if (signer.provider === undefined) {
      throw new Error('Provider is required');
    }

    const provider = signer.provider;

    const config = await StrictMarginlyDeployConfig.fromConfig(logger, rawConfig);

    if (config.connection.assertChainId !== undefined) {
      const expectedChainId = config.connection.assertChainId;
      const { chainId: actualChainId } = await provider.getNetwork();
      if (actualChainId !== expectedChainId) {
        throw new Error(`Wrong chain id ${actualChainId}. Expected to be ${expectedChainId}`);
      }
    }

    const marginlyDeployer = new MarginlyDeployer(signer, config.connection.ethOptions, stateStore, logger);

    return { config, provider, marginlyDeployer };
  });

  const balanceBefore = await signer.getBalance();

  try {
    const tokenRepository = await using(logger.beginScope('Process tokens'), async () => {
      const tokenRepository = new TokenRepository(provider, marginlyDeployer);

      for (const token of config.tokens) {
        await tokenRepository.materializeToken(token);
      }

      return tokenRepository;
    });

    const { uniswapFactoryAddress, uniswapSwapRouterAddress } =
      await using(logger.beginScope('Process unsiwap'), async () => {
          if (isMarginlyConfigUniswapGenuine(config.uniswap)) {
            const uniswapConfig = config.uniswap;
            await using(logger.beginScope('Create uniswap pools'), async () => {
              for (const pool of uniswapConfig.pools) {
                const uniswapPoolDeploymentResult = await marginlyDeployer.getOrCreateUniswapPoolGenuine(uniswapConfig.factory, pool, tokenRepository);
                printDeployState(`Uniswap Pool '${pool.id}'`, uniswapPoolDeploymentResult, logger);
              }
            });
            return {
              uniswapFactoryAddress: config.uniswap.factory,
              uniswapSwapRouterAddress: config.uniswap.swapRouter,
            };
          } else if (isMarginlyConfigUniswapMock(config.uniswap)) {
            const uniswapConfig = config.uniswap;
            const uniswapRouterDeploymentResult = await marginlyDeployer.deployUniswapRouterMock(
              uniswapConfig.weth9Token,
              tokenRepository,
            );
            const uniswapRouterContract = uniswapRouterDeploymentResult.contract;
            for (const pool of uniswapConfig.pools) {
              const uniswapPoolDeploymentResult = await marginlyDeployer.deployUniswapPoolMock(
                uniswapConfig.oracle,
                pool,
                tokenRepository,
              );
              const { address: tokenAAddress } = tokenRepository.getTokenInfo(pool.tokenA.id);
              const { address: tokenBAddress } = tokenRepository.getTokenInfo(pool.tokenB.id);
              const uniswapFee = MarginlyDeployer.toUniswapFee(pool.fee);
              await (await uniswapRouterContract.setPool(tokenAAddress.toString(), tokenBAddress.toString(), uniswapFee, uniswapPoolDeploymentResult.address)).wait();

              const [token0, token1] = sortUniswapPoolTokens(
                [tokenAAddress.toString(), tokenBAddress.toString()],
                [pool.tokenA, pool.tokenB],
              );

              const priceToken = pool[pool.priceBaseTokenKey];
              let price: number;
              if (token0.id === priceToken.id) {
                price = pool.price;
              } else {
                price = 1 / pool.price;
              }

              const { decimals: token0Decimals } = tokenRepository.getTokenInfo(token0.id);
              const { decimals: token1Decimals } = tokenRepository.getTokenInfo(token1.id);

              const priceFp18 = priceToPriceFp18(price, token0Decimals, token1Decimals);
              const sqrtPriceX96 = priceToSqrtPriceX96(price, token0Decimals, token1Decimals);

              const uniswapPoolContract = uniswapPoolDeploymentResult.contract;

              await (await uniswapPoolContract.setPrice(priceFp18, sqrtPriceX96)).wait();
              await (await uniswapPoolContract.increaseObservationCardinalityNext(config.uniswap.priceLogSize)).wait();

              const uniswapPoolAddress = EthAddress.parse(uniswapPoolDeploymentResult.address);

              if (pool.tokenABalance !== undefined) {
                await marginlyDeployer.ensureTokenAmount(pool.tokenA, uniswapPoolAddress, pool.tokenABalance, tokenRepository);
              }
              if (pool.tokenBBalance !== undefined) {
                await marginlyDeployer.ensureTokenAmount(pool.tokenB, uniswapPoolAddress, pool.tokenBBalance, tokenRepository);
              }
              const ownerAddress = EthAddress.parse(await signer.getAddress());
              await marginlyDeployer.ensureTokenAmount(pool.tokenA, ownerAddress, RationalNumber.parse('1_000_000'), tokenRepository);
              await marginlyDeployer.ensureTokenAmount(pool.tokenB, ownerAddress, RationalNumber.parse('1_000_000'), tokenRepository);
            }

            return {
              uniswapFactoryAddress: EthAddress.parse(uniswapRouterDeploymentResult.address),
              uniswapSwapRouterAddress: EthAddress.parse(uniswapRouterDeploymentResult.address),
            };
          } else {
            throw new Error('Unknown Uniswap type');
          }
        },
      );

    const marginlyFactoryDeployResult = await using(logger.beginScope('Deploy marginly factory'), async () => {
      const marginlyFactoryDeployResult = await marginlyDeployer.deployMarginlyFactory(
        EthAddress.parse('0x0000000000000000000000000000000000000000'),
        uniswapFactoryAddress,
        uniswapSwapRouterAddress,
        config.marginlyFactory.feeHolder,
        config.marginlyFactory.weth9Token,
        tokenRepository,
      );
      printDeployState('Marginly Factory', marginlyFactoryDeployResult, logger);

      return marginlyFactoryDeployResult;
    });

    const deployedMarginlyPools = await using(logger.beginScope('Create marginly pools'), async () => {
      const deployedMarginlyPools: MarginlyDeploymentMarginlyPool[] = [];
      for (const pool of config.marginlyPools) {
        const marginlyPoolDeploymentResult = await marginlyDeployer.getOrCreateMarginlyPool(
          marginlyFactoryDeployResult.contract,
          pool,
          tokenRepository,
        );
        deployedMarginlyPools.push({
          id: pool.id,
          address: marginlyPoolDeploymentResult.address,
        });
        printDeployState(`Marginly Pool '${pool.id}'`, marginlyPoolDeploymentResult, logger);
      }
      return deployedMarginlyPools;
    });

  let marginlyKeeperAddress = getMarginlyKeeperAddress(stateStore);
  if (!marginlyKeeperAddress) {
    let aavePoolAddressesProviderAddress: EthAddress;

      if (config.marginlyKeeper.aavePoolAddressesProvider.allowCreateMock) {
        const deployedMockAavePool = await using(logger.beginScope('Deploy MockAavePool'), async () => {
          const deploymentResult = await marginlyDeployer.getOrCreateMockAavePool();
          printDeployState(`Mock AAVE pool`, deploymentResult, logger);
          return deploymentResult;
        });

        const deployedMockAavePoolAddressesProvider = await using(
          logger.beginScope('Deploy MockAavePoolAddressesProvider'),
          async () => {
            const deploymentResult = await marginlyDeployer.getOrCreateMockAavePoolAddressesProvider(
              EthAddress.parse(deployedMockAavePool.address),
            );
            printDeployState(`MockAavePoolAddressesProvider`, deploymentResult, logger);
            return deploymentResult;
          },
        );
        aavePoolAddressesProviderAddress = EthAddress.parse(deployedMockAavePoolAddressesProvider.address);
      } else if (config.marginlyKeeper.aavePoolAddressesProvider.address) {
        const aavePoolAddressesProvider = marginlyDeployer.getAavePoolAddressesProvider(
          config.marginlyKeeper.aavePoolAddressesProvider.address,
        );

        aavePoolAddressesProviderAddress = EthAddress.parse(aavePoolAddressesProvider.address);
      }

      const deployedMarginlyKeeper = await using(logger.beginScope('Deploy MarginlyKeeper'), async () => {
        const deploymentResult = await marginlyDeployer.deployMarginlyKeeper(aavePoolAddressesProviderAddress);
        printDeployState(`Marginly keeper`, deploymentResult, logger);
        return deploymentResult;
      });

      marginlyKeeperAddress = deployedMarginlyKeeper.address;
    }

    return {
      marginlyPools: deployedMarginlyPools,
      marginlyKeeper: { address: marginlyKeeperAddress },
    };
  } finally {
    const balanceAfter = await signer.getBalance();
    const ethSpent = balanceBefore.sub(balanceAfter);

    logger.log(`ETH spent: ${ethers.utils.formatEther(ethSpent)}`);
  }
}
