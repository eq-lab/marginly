import { EthAddress } from '@marginly/common';
import {
  ChainlinkOracleConfig,
  PythOracleConfig,
  UniswapV3TickDoubleOracleConfig,
  UniswapV3TickOracleConfig,
} from './configs';
import { DeployResult, ITokenRepository } from '../common/interfaces';
import { Signer, ethers } from 'ethers';
import { EthOptions } from '../config';
import { StateStore } from '../common';
import { Logger } from '../logger';
import { createMarginlyPeripheryOracleReader } from './contract-reader';
import { BaseDeployer } from './BaseDeployer';

export class PriceOracleDeployer extends BaseDeployer {
  private readonly readMarginlyPeripheryOracleContract;

  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    super(signer, ethArgs, stateStore, logger);
    this.readMarginlyPeripheryOracleContract = createMarginlyPeripheryOracleReader();
  }

  public async deployAndConfigureUniswapV3TickOracle(
    config: UniswapV3TickOracleConfig,
    uniswapV3Factory: EthAddress,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'UniswapV3TickOracle',
      [uniswapV3Factory.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;

    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);

      const encodedOptions = ethers.utils.defaultAbiCoder.encode(
        ['uint16', 'uint16', 'uint24'],
        [
          setting.secondsAgo.toSeconds(),
          setting.secondsAgoLiquidation.toSeconds(),
          this.toUniswapFee(setting.uniswapFee),
        ]
      );

      const currentEncodedOptions = await priceOracle.getParamsEncoded(quoteToken.toString(), baseToken.toString());
      if (currentEncodedOptions != encodedOptions) {
        this.logger.log(`Set oracle ${config.id} options`);
        await priceOracle.setOptions(quoteToken.toString(), baseToken.toString(), encodedOptions);
      }

      this.logger.log(`Check oracle ${config.id}`);

      const balancePrice = await priceOracle.getBalancePrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`BalancePrice is ${balancePrice}`);

      const liquidationPrice = await priceOracle.getMargincallPrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`LiquidationPrice is ${liquidationPrice}`);
    }

    return deploymentResult;
  }

  public async deployAndConfigureUniswapV3TickDoubleOracle(
    config: UniswapV3TickDoubleOracleConfig,
    uniswapV3Factory: EthAddress,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'UniswapV3TickOracleDouble',
      [uniswapV3Factory.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;
    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
      const { address: intermediateToken } = tokenRepository.getTokenInfo(setting.intermediateToken.id);

      const encodedOptions = ethers.utils.defaultAbiCoder.encode(
        ['uint16', 'uint16', 'uint24', 'uint24', 'address'],
        [
          setting.secondsAgo.toSeconds(),
          setting.secondsAgoLiquidation.toSeconds(),
          this.toUniswapFee(setting.baseTokenPairFee),
          this.toUniswapFee(setting.quoteTokenPairFee),
          intermediateToken.toString(),
        ]
      );

      const currentEncodedOptions = await priceOracle.getParamsEncoded(quoteToken.toString(), baseToken.toString());
      if (currentEncodedOptions != encodedOptions) {
        this.logger.log(`Set oracle ${config.id} options`);
        await priceOracle.setOptions(quoteToken.toString(), baseToken.toString(), encodedOptions);
      }

      this.logger.log(`Check oracle ${config.id}`);

      const balancePrice = await priceOracle.getBalancePrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`BalancePrice is ${balancePrice}`);

      const liquidationPrice = await priceOracle.getMargincallPrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`LiquidationPrice is ${liquidationPrice}`);
    }

    return deploymentResult;
  }

  public async deployAndConfigureChainlinkOracle(
    config: ChainlinkOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'ChainlinkOracle',
      [],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;

    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);

      await priceOracle.setOptions(quoteToken.toString(), baseToken.toString(), setting.aggregatorV3.toString());
    }

    return deploymentResult;
  }

  public async deployAndConfigurePythOracle(
    config: PythOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'PythOracle',
      [config.pyth.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;

    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);

      await priceOracle.setOptions(quoteToken.toString(), baseToken.toString(), setting.pythPriceId);
    }

    return deploymentResult;
  }
}
