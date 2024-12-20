import {
  AlgebraDoubleOracleConfig,
  AlgebraOracleConfig,
  ChainlinkOracleConfig,
  CurveOracleConfig,
  isDoublePairChainlinkOracleConfig,
  isDoublePairPythOracleConfig,
  isSinglePairChainlinkOracleConfig,
  isSinglePairPythOracleConfig,
  PendleOracleConfig,
  PythOracleConfig,
  UniswapV3TickDoubleOracleConfig,
  UniswapV3TickOracleConfig,
} from './configs';
import { DeployResult, ITokenRepository } from '../common/interfaces';
import { BigNumber, Signer, ethers } from 'ethers';
import { EthOptions } from '../config';
import { StateStore } from '../common';
import { Logger } from '../logger';
import { createMarginlyPeripheryOracleReader } from './contract-reader';
import { BaseDeployer } from './BaseDeployer';

type OracleParams = {
  initialized: boolean;
  secondsAgo: BigNumber;
  secondsAgoLiquidation: BigNumber;
  uniswapFee: BigNumber;
};

type OracleDoubleParams = {
  initialized: boolean;
  secondsAgo: BigNumber;
  secondsAgoLiquidation: BigNumber;
  baseTokenPairFee: BigNumber;
  quoteTokenPairFee: BigNumber;
  intermediateToken: string;
};

export class PriceOracleDeployer extends BaseDeployer {
  private readonly readMarginlyPeripheryOracleContract;

  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    super(signer, ethArgs, stateStore, logger);
    this.readMarginlyPeripheryOracleContract = createMarginlyPeripheryOracleReader();
  }

  public async deployAndConfigureUniswapV3TickOracle(
    config: UniswapV3TickOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'UniswapV3TickOracle',
      [config.factory.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;

    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
      const secondsAgo = setting.secondsAgo.toSeconds();
      const secondsAgoLiquidation = setting.secondsAgoLiquidation.toSeconds();
      const uniswapFee = this.toUniswapFee(setting.uniswapFee);

      const currentParams: OracleParams = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());
      if (
        !currentParams.initialized ||
        !secondsAgo.eq(currentParams.secondsAgo) ||
        !secondsAgoLiquidation.eq(currentParams.secondsAgoLiquidation) ||
        !uniswapFee.eq(currentParams.uniswapFee)
      ) {
        this.logger.log(`Set oracle ${config.id} options`);

        const tx = await priceOracle.setOptions(
          quoteToken.toString(),
          baseToken.toString(),
          secondsAgo,
          secondsAgoLiquidation,
          uniswapFee
        );
        await tx.wait();
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
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'UniswapV3TickOracleDouble',
      [config.factory.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;
    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
      const { address: intermediateToken } = tokenRepository.getTokenInfo(setting.intermediateToken.id);

      const secondsAgo = setting.secondsAgo.toSeconds();
      const secondsAgoLiquidation = setting.secondsAgoLiquidation.toSeconds();
      const baseTokenPairFee = this.toUniswapFee(setting.baseTokenPairFee);
      const quoteTokenPairFee = this.toUniswapFee(setting.quoteTokenPairFee);

      const currentParams: OracleDoubleParams = await priceOracle.getParamsEncoded(
        quoteToken.toString(),
        baseToken.toString()
      );

      if (
        !currentParams.initialized ||
        !currentParams.secondsAgo.eq(secondsAgo) ||
        !currentParams.secondsAgoLiquidation.eq(secondsAgoLiquidation) ||
        !currentParams.baseTokenPairFee.eq(baseTokenPairFee) ||
        !currentParams.quoteTokenPairFee.eq(quoteTokenPairFee) ||
        currentParams.intermediateToken.toLowerCase() !== intermediateToken.toString().toLowerCase()
      ) {
        this.logger.log(`Set oracle ${config.id} options`);
        await priceOracle.setOptions(
          quoteToken.toString(),
          baseToken.toString(),
          secondsAgo,
          secondsAgoLiquidation,
          baseTokenPairFee,
          quoteTokenPairFee,
          intermediateToken.toString()
        );
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
      if (isSinglePairChainlinkOracleConfig(setting)) {
        const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
        const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);

        await priceOracle.setPair(quoteToken.toString(), baseToken.toString(), setting.aggregatorV3.toString());
      } else if (isDoublePairChainlinkOracleConfig(setting)) {
        const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
        const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
        const { address: intermediateToken } = tokenRepository.getTokenInfo(setting.intermediateToken.id);

        await priceOracle.setPair(
          intermediateToken.toString(),
          quoteToken.toString(),
          setting.quoteAggregatorV3.toString()
        );
        await priceOracle.setPair(
          intermediateToken.toString(),
          baseToken.toString(),
          setting.baseAggregatorV3.toString()
        );
        await priceOracle.setCompositePair(quoteToken.toString(), intermediateToken.toString(), baseToken.toString());
      } else {
        throw new Error('Unknown pair type');
      }
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
      if (isSinglePairPythOracleConfig(setting)) {
        const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
        const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);

        await priceOracle.setPair(quoteToken.toString(), baseToken.toString(), setting.pythPriceId);
      } else if (isDoublePairPythOracleConfig(setting)) {
        const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
        const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
        const { address: intermediateToken } = tokenRepository.getTokenInfo(setting.intermediateToken.id);

        await priceOracle.setPair(
          intermediateToken.toString(),
          quoteToken.toString(),
          setting.quotePythPriceId.toString()
        );
        await priceOracle.setPair(
          intermediateToken.toString(),
          baseToken.toString(),
          setting.basePythPriceId.toString()
        );
        await priceOracle.setCompositePair(quoteToken.toString(), intermediateToken.toString(), baseToken.toString());
      } else {
        throw new Error('Unknown pair type');
      }
    }

    return deploymentResult;
  }

  public async deployAndConfigurePendleOracle(
    config: PendleOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'PendleOracle',
      [config.pendlePtLpOracle.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;
    for (const setting of config.settings) {
      //find secondary oracle among deployed oracles
      const secondaryPoolOracle = this.stateStore.getById(`priceOracle_${setting.secondaryPoolOracleId}`);
      if (!secondaryPoolOracle) {
        throw new Error(`Secondary pool oracle ${setting.secondaryPoolOracleId} not found`);
      }

      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
      const { address: ibToken } = tokenRepository.getTokenInfo(setting.ibToken.id);

      const currentParams = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());

      if (currentParams.secondsAgo != 0) continue; // oracle already initialized

      const tx = await priceOracle.setPair(
        quoteToken.toString(),
        baseToken.toString(),
        setting.pendleMarket.toString(),
        secondaryPoolOracle.address,
        ibToken.toString(),
        setting.secondsAgo.toSeconds(),
        setting.secondsAgoLiquidation.toSeconds()
      );
      await tx.wait();
    }

    return deploymentResult;
  }

  public async deployAlgebraOracle(
    config: AlgebraOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'AlgebraTickOracle',
      [config.factory.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;

    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
      const secondsAgo = setting.secondsAgo.toSeconds();
      const secondsAgoLiquidation = setting.secondsAgoLiquidation.toSeconds();

      const currentParams: OracleParams = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());
      if (
        !currentParams.initialized ||
        !secondsAgo.eq(currentParams.secondsAgo) ||
        !secondsAgoLiquidation.eq(currentParams.secondsAgoLiquidation)
      ) {
        this.logger.log(`Set oracle ${config.id} options`);

        const tx = await priceOracle.setOptions(
          quoteToken.toString(),
          baseToken.toString(),
          secondsAgo,
          secondsAgoLiquidation
        );
        await tx.wait();
      }

      this.logger.log(`Check oracle ${config.id}`);

      const balancePrice = await priceOracle.getBalancePrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`BalancePrice is ${balancePrice}`);

      const liquidationPrice = await priceOracle.getMargincallPrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`LiquidationPrice is ${liquidationPrice}`);
    }

    return deploymentResult;
  }

  public async deployAlgebraDoubleOracle(
    config: AlgebraDoubleOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'AlgebraTickOracleDouble',
      [config.factory.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;
    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
      const { address: intermediateToken } = tokenRepository.getTokenInfo(setting.intermediateToken.id);

      const secondsAgo = setting.secondsAgo.toSeconds();
      const secondsAgoLiquidation = setting.secondsAgoLiquidation.toSeconds();

      const currentParams: OracleDoubleParams = await priceOracle.getParamsEncoded(
        quoteToken.toString(),
        baseToken.toString()
      );

      if (
        !currentParams.initialized ||
        !currentParams.secondsAgo.eq(secondsAgo) ||
        !currentParams.secondsAgoLiquidation.eq(secondsAgoLiquidation) ||
        currentParams.intermediateToken.toLowerCase() !== intermediateToken.toString().toLowerCase()
      ) {
        this.logger.log(`Set oracle ${config.id} options`);
        const tx = await priceOracle.setOptions(
          quoteToken.toString(),
          baseToken.toString(),
          secondsAgo,
          secondsAgoLiquidation,
          intermediateToken.toString()
        );
        await tx.wait();
      }

      this.logger.log(`Check oracle ${config.id}`);

      const balancePrice = await priceOracle.getBalancePrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`BalancePrice is ${balancePrice}`);

      const liquidationPrice = await priceOracle.getMargincallPrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`LiquidationPrice is ${liquidationPrice}`);
    }

    return deploymentResult;
  }

  public async deployCurveOracle(config: CurveOracleConfig, tokenRepository: ITokenRepository): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'CurveOracle',
      [],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );
    const priceOracle = (await deploymentResult).contract;

    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);

      this.logger.log(`Set oracle ${config.id} options`);

      console.log(`Curve: ${setting.pool.toString()}`);
      console.log(`Quote token: ${quoteToken.toString()}`);
      console.log(`Base token: ${baseToken.toString()}`);

      const abi = [
        'function price_oracle() external view returns (uint256)',
        'function price_oracle(uint256 i) external view returns (uint256)',
        'function N_COINS() external view returns (uint256)',
        'function coins(uint256 coinId) external view returns (address)',
      ];
      const pool = new ethers.Contract(setting.pool.toString(), abi, this.provider);

      let moreThanTwoTokens = false;
      try {
        await pool.coins(2);
        moreThanTwoTokens = true;
      } catch (e) {}

      if (moreThanTwoTokens) {
        throw new Error(`Curve pools with more than two tokens are not allowed. Pool id: ${config.id}`);
      }

      let priceOracleMethodHaveArg: boolean | undefined = undefined;
      try {
        await pool['price_oracle()']();
        priceOracleMethodHaveArg = false;
      } catch (e) {}

      if (priceOracleMethodHaveArg === undefined) {
        try {
          await pool['price_oracle(uint256)'](0);
          priceOracleMethodHaveArg = true;
        } catch (e) {}
      }
      if (priceOracleMethodHaveArg === undefined) {
        throw new Error(`Curve pool has neither 'price_oracle()' nor 'price_oracle(uin256 i)' methods`);
      }

      const currentParams = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());

      if (currentParams.pool.toLowerCase() !== setting.pool.toString().toLowerCase()) {
        this.logger.log(`Add pool ${setting.pool.toString()}`);
        const tx = await priceOracle.addPool(
          setting.pool.toString(),
          quoteToken.toString(),
          baseToken.toString(),
          priceOracleMethodHaveArg
        );
        await tx.wait();
      }

      this.logger.log(`Check oracle ${config.id}`);
      const balancePrice = await priceOracle.getBalancePrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`BalancePrice is ${balancePrice}`);

      const liquidationPrice = await priceOracle.getMargincallPrice(quoteToken.toString(), baseToken.toString());
      this.logger.log(`LiquidationPrice is ${liquidationPrice}`);
    }
    return deploymentResult;
  }
}
