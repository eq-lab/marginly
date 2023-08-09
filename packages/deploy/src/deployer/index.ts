import { Contract, Signer } from 'ethers';
import { EthOptions } from '../config';
import { Logger } from '../logger';
import { ContractDescription, ContractReader, EthAddress, RationalNumber } from '@marginly/common';
import { BigNumber } from '@ethersproject/bignumber';
import * as ethers from 'ethers';
import {
  isMarginlyConfigMintableToken,
  MarginlyConfigToken,
  readMarginlyRouterContract,
  readUniswapMockContract,
  StateStore,
} from '../common';
import { DeployResult, IMarginlyDeployer, ITokenRepository, LimitedDeployResult } from '../common/interfaces';
import { MarginlyConfigMarginlyPool, MarginlyConfigUniswapPoolGenuine, MarginlyConfigUniswapPoolMock } from './configs';
import { sortUniswapPoolTokens } from '@marginly/common/dist/math';

export class MarginlyDeployer implements IMarginlyDeployer {
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

  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
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
    tokenRepository: ITokenRepository,
    techPositionOwner: EthAddress
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
        techPositionOwner.toString(),
      ],
      'marginlyFactory'
    );
  }

  public deployMarginlyKeeper(aavePoolAddressesProvider: EthAddress): Promise<DeployResult> {
    return this.deploy('MarginlyKeeper', [aavePoolAddressesProvider.toString()], 'marginlyKeeper');
  }

  public toUniswapFee(fee: RationalNumber): BigNumber {
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
      this.toUniswapFee(fee)
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
    tokenRepository: ITokenRepository
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

    const [token0Address, token1Address] = sortUniswapPoolTokens(
      [tokenAAddress.toString(), tokenBAddress.toString()],
      [tokenAAddress, tokenBAddress]
    );

    let uniswapPoolAddress = EthAddress.parse(
      await uniswapFactoryContract.getPool(
        token0Address.toString(),
        token1Address.toString(),
        this.toUniswapFee(config.fee)
      )
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
        this.toUniswapFee(config.fee),
        this.ethArgs
      );
      await tx.wait();
      uniswapPoolAddress = await this.getCreatedUniswapPoolAddress(
        uniswapFactoryContract,
        tx.hash,
        token0Address,
        token1Address,
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
    config: MarginlyConfigMarginlyPool,
    tokenRepository: ITokenRepository
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

    const quoteTokenInfo = tokenRepository.getTokenInfo(config.quoteToken.id);
    const baseTokenInfo = tokenRepository.getTokenInfo(config.baseToken.id);
    let marginlyPoolAddress = EthAddress.parse(
      await marginlyPoolFactoryContract.getPool(
        quoteTokenInfo.address.toString(),
        baseTokenInfo.address.toString(),
        this.toUniswapFee(config.uniswapPool.fee)
      )
    );
    let creationTxHash: string | undefined = undefined;

    if (marginlyPoolAddress.isZero()) {
      this.logger.log('Marginly pool not found. Creating new one');
      const one = BigNumber.from(1e6);
      const baseOne = BigNumber.from(10).pow(baseTokenInfo.decimals);
      const quoteOne = BigNumber.from(10).pow(quoteTokenInfo.decimals);
      const params = {
        interestRate: config.params.interestRate.mul(one).toInteger(),
        fee: config.params.fee.mul(one).toInteger(),
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
        this.toUniswapFee(config.uniswapPool.fee),
        params,
        this.ethArgs
      );
      await tx.wait();
      marginlyPoolAddress = await this.getCreatedMarginlyPoolAddress(
        marginlyPoolFactoryContract,
        tx.hash,
        quoteTokenInfo.address,
        baseTokenInfo.address
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

  public async getOrCreateMockAavePool(): Promise<LimitedDeployResult> {
    const stateFileId = `mockAavePool`;
    const mockAavePoolContractDescription = this.readMarginlyMockContract('MockAavePool');

    const stateFromFile = this.stateStore.getById(stateFileId);
    if (stateFromFile !== undefined) {
      this.logger.log(`Import MockAavePool from state file`);

      const mockAavePoolContract = new ethers.Contract(
        stateFromFile.address,
        mockAavePoolContractDescription.abi,
        this.provider
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
      'MockAavePoolAddressesProvider'
    );

    const stateFromFile = this.stateStore.getById(stateFileId);
    if (stateFromFile !== undefined) {
      this.logger.log(`Import MockAavePool from state file`);

      const mockAavePoolAddressesProviderContract = new ethers.Contract(
        stateFromFile.address,
        mockAavePoolAddressesProviderContractDescription.abi,
        this.provider
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
      this.readMarginlyMockContract
    );
  }

  public getAavePoolAddressesProvider(address: EthAddress): ethers.Contract {
    const aavePoolAddressesProviderContractDescription = this.readAaveContract('IPoolAddressesProvider');
    return new ethers.Contract(address.toString(), aavePoolAddressesProviderContractDescription.abi, this.signer);
  }

  public deployMintableToken(name: string, symbol: string, decimals: number): Promise<DeployResult> {
    return this.deploy('MintableToken', [name, symbol, decimals], `token_${symbol}`, readUniswapMockContract);
  }

  public async deployMarginlyRouter(
    pools: { dex: number; token0Address: string; token1Address: string; poolAddress: string }[]
  ): Promise<DeployResult> {
    const args = pools.map((x) => [x.dex, x.token0Address, x.token1Address, x.poolAddress]);
    return this.deploy('MarginlyRouter', args, 'MarginlyRouter', readMarginlyRouterContract);
  }

  public async deployUniswapRouterMock(
    weth9: MarginlyConfigToken,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const { address } = tokenRepository.getTokenInfo(weth9.id);
    return this.deploy('SwapRouterMock', [address.toString()], 'swapRouterMock', readUniswapMockContract);
  }

  public async deployUniswapPoolMock(
    oracle: EthAddress,
    poolConfig: MarginlyConfigUniswapPoolMock,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const { address: tokenAAddress } = tokenRepository.getTokenInfo(poolConfig.tokenA.id);
    const { address: tokenBAddress } = tokenRepository.getTokenInfo(poolConfig.tokenB.id);
    return this.deploy(
      'UniswapV3PoolMock',
      [oracle.toString(), tokenAAddress.toString(), tokenBAddress.toString(), this.toUniswapFee(poolConfig.fee)],
      `uniswapV3PoolMock_${poolConfig.id}`,
      readUniswapMockContract
    );
  }

  public async ensureTokenAmount(
    token: MarginlyConfigToken,
    ethAddress: EthAddress,
    amount: RationalNumber,
    tokenRepository: ITokenRepository
  ): Promise<void> {
    if (isMarginlyConfigMintableToken(token)) {
      const tokenInfo = tokenRepository.getTokenInfo(token.id);
      const tokenContractDescription = readUniswapMockContract('MintableToken');
      const tokenContract = new ethers.Contract(
        tokenInfo.address.toString(),
        tokenContractDescription.abi,
        this.signer
      );
      const one = BigNumber.from(10).pow(tokenInfo.decimals);

      const desiredBalance = amount.mul(one).toInteger();
      const currentBalance: BigNumber = await tokenContract.balanceOf(ethAddress.toString());

      if (currentBalance.lt(desiredBalance)) {
        await tokenContract.mint(ethAddress.toString(), desiredBalance.sub(currentBalance));
      }
    } else {
      throw new Error(`Unable to set balance for token ${token.id}`);
    }
  }
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

const deployTemplate = (
  signer: Signer,
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
    const contractDescription = contractReaderOverride(name);
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
