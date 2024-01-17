import { EthAddress, RationalNumber } from '@marginly/common';
import { sortUniswapPoolTokens } from '@marginly/common/math';
import { Signer, ethers } from 'ethers';
import { MarginlyConfigToken, StateStore, readUniswapMockContract } from '../common';
import { DeployResult, ITokenRepository, LimitedDeployResult } from '../common/interfaces';
import { EthOptions } from '../config';
import { Logger } from '../logger';
import { BaseDeployer } from './BaseDeployer';
import { MarginlyConfigUniswapPoolGenuine, MarginlyConfigUniswapPoolMock } from './configs';
import { createMarginlyMockContractReader, createUniswapV3CoreInterfacesReader } from './contract-reader';

export class UniswapV3Deployer extends BaseDeployer {
  private readonly readUniswapCoreInterface;
  private readonly readMarginlyMockContract;

  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    super(signer, ethArgs, stateStore, logger);

    this.readUniswapCoreInterface = createUniswapV3CoreInterfacesReader();
    this.readMarginlyMockContract = createMarginlyMockContractReader();
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

  public async deployUniswapRouterMock(
    weth9: MarginlyConfigToken,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const { address } = tokenRepository.getTokenInfo(weth9.id);
    return this.deploy('SwapRouterMock', [address.toString()], 'swapRouterMock', readUniswapMockContract);
  }

  public async deployUniswapV3FactoryMock(): Promise<DeployResult> {
    return this.deploy('UniswapV3FactoryMock', [], 'uniswapV3FactoryMock', readUniswapMockContract);
  }

  public async getOrCreateUniswapV3PoolMock(
    uniswapFactoryContract: ethers.Contract,
    oracle: EthAddress,
    poolConfig: MarginlyConfigUniswapPoolMock,
    tokenRepository: ITokenRepository
  ): Promise<LimitedDeployResult> {
    const { address: tokenAAddress } = tokenRepository.getTokenInfo(poolConfig.tokenA.id);
    const { address: tokenBAddress } = tokenRepository.getTokenInfo(poolConfig.tokenB.id);

    const uniswapMockContractDescription = readUniswapMockContract('UniswapV3PoolMock');

    let uniswapV3PoolMock = EthAddress.parse(
      await uniswapFactoryContract.getPool(
        tokenAAddress.toString(),
        tokenBAddress.toString(),
        this.toUniswapFee(poolConfig.fee)
      )
    );

    let txHash: string | undefined = undefined;
    if (uniswapV3PoolMock.isZero()) {
      const tx = await uniswapFactoryContract.createPool(
        oracle.toString(),
        tokenAAddress.toString(),
        tokenBAddress.toString(),
        this.toUniswapFee(poolConfig.fee)
      );
      await tx.wait();

      uniswapV3PoolMock = await this.getCreatedUniswapPoolAddress(
        uniswapFactoryContract,
        tx.hash,
        tokenAAddress,
        tokenBAddress,
        poolConfig.fee
      );
      txHash = tx.hash;
    }

    const contract = new ethers.Contract(uniswapV3PoolMock.toString(), uniswapMockContractDescription.abi, this.signer);

    return {
      address: uniswapV3PoolMock.toString(),
      contract,
      txHash,
    };
  }
}
