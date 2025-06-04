import {
  AavePriceOracleConfig,
  AlgebraDoubleOracleConfig,
  AlgebraOracleConfig,
  ChainlinkOracleConfig,
  CurveOracleConfig,
  EulerPriceOracleConfig,
  isAavePriceOracle,
  isAlgebraDoubleOracle,
  isAlgebraOracle,
  isChainlinkOracle,
  isCurveOracle,
  isDoublePairChainlinkOracleConfig,
  isDoublePairPythOracleConfig,
  isEulerPriceOracle,
  isMarginlyCompositeOracle,
  isPendleMarketOracle,
  isPendleOracle,
  isPriceOracleProxy,
  isPythOracle,
  isSinglePairChainlinkOracleConfig,
  isSinglePairPythOracleConfig,
  isUniswapV3DoubleOracle,
  isUniswapV3Oracle,
  MarginlyCompositeOracleConfig,
  PendleMarketOracleConfig,
  PendleOracleConfig,
  PriceOracleConfig,
  PriceOracleProxyConfig,
  PythOracleConfig,
  UniswapV3TickDoubleOracleConfig,
  UniswapV3TickOracleConfig,
} from './configs';
import { DeployResult, ITokenRepository } from '../common/interfaces';
import { BigNumber, Signer, ethers } from 'ethers';
import { EthOptions } from '../config';
import { DeployState, MarginlyConfigToken, printDeployState, StateStore } from '../common';
import { Logger } from '../logger';
import { createMarginlyPeripheryOracleReader } from './contract-reader';
import { BaseDeployer } from './BaseDeployer';
import { EthAddress } from '@marginly/common';

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

  private getRequiredPriceOracle(priceOracleId: string): DeployState {
    const priceOracle = this.stateStore.getById(`priceOracle_${priceOracleId}`);
    if (!priceOracle) {
      throw new Error(`Price oracle not found by id ${priceOracleId}`);
    }
    return priceOracle;
  }

  private async checkOraclePrice(
    priceOracleId: string,
    priceOracle: any,
    quoteToken: string,
    baseToken: string
  ): Promise<void> {
    this.logger.log(`Check oracle ${priceOracleId}`);

    const balancePrice = await priceOracle.getBalancePrice(quoteToken.toString(), baseToken.toString());
    this.logger.log(`BalancePrice is ${balancePrice}`);

    const liquidationPrice = await priceOracle.getMargincallPrice(quoteToken.toString(), baseToken.toString());
    this.logger.log(`LiquidationPrice is ${liquidationPrice}`);
  }

  private async deployAndConfigureUniswapV3TickOracle(
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
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);

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

      await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
    }
    setupOracleScope.close();
    return deploymentResult;
  }

  private async deployAndConfigureUniswapV3TickDoubleOracle(
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
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);
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
        const tx = await priceOracle.setOptions(
          quoteToken.toString(),
          baseToken.toString(),
          secondsAgo,
          secondsAgoLiquidation,
          baseTokenPairFee,
          quoteTokenPairFee,
          intermediateToken.toString()
        );
        await tx.wait();
      }

      await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
    }
    setupOracleScope.close();
    return deploymentResult;
  }

  private async deployAndConfigureChainlinkOracle(
    config: ChainlinkOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'ChainlinkOracle',
      [config.sequencerFeed.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);

    for (const setting of config.settings) {
      const settingName = `${setting.baseToken.id}/${setting.quoteToken.id}`;
      if (isSinglePairChainlinkOracleConfig(setting)) {
        const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
        const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
        const maxPriceAge = setting.maxPriceAge.toSeconds();

        const currentParams = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());
        if (!BigNumber.from(currentParams.maxPriceAge).eq(maxPriceAge)) {
          this.logger.log(`Set up ${settingName}\n`);

          const tx = await priceOracle.setPair(
            quoteToken.toString(),
            baseToken.toString(),
            setting.aggregatorV3.toString(),
            maxPriceAge
          );
          tx.wait();
        }

        await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
      } else if (isDoublePairChainlinkOracleConfig(setting)) {
        const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
        const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);

        let intermediateToken: EthAddress;
        if (setting.intermediateToken === 'usd') {
          intermediateToken = EthAddress.parse(ethers.constants.AddressZero);
        } else {
          const token = tokenRepository.getTokenInfo((setting.intermediateToken as MarginlyConfigToken).id);
          intermediateToken = token.address;
        }

        const maxPriceAge = setting.maxPriceAge.toSeconds();

        const intermQuoteTokenParams = await priceOracle.getParams(quoteToken.toString(), intermediateToken.toString());
        const baseIntermediateParams = await priceOracle.getParams(intermediateToken.toString(), baseToken.toString());
        if (
          !BigNumber.from(intermQuoteTokenParams.maxPriceAge).eq(maxPriceAge) ||
          !BigNumber.from(baseIntermediateParams.maxPriceAge).eq(maxPriceAge)
        ) {
          this.logger.log(`Setup double ${settingName}\n`);

          let tx = await priceOracle.setPair(
            intermediateToken.toString(),
            quoteToken.toString(),
            setting.quoteAggregatorV3.toString(),
            maxPriceAge
          );
          await tx.wait();
          tx = await priceOracle.setPair(
            intermediateToken.toString(),
            baseToken.toString(),
            setting.baseAggregatorV3.toString(),
            maxPriceAge
          );
          await tx.wait();
          tx = await priceOracle.setCompositePair(
            quoteToken.toString(),
            intermediateToken.toString(),
            baseToken.toString()
          );
          await tx.wait();
        }

        await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
      } else {
        throw new Error('Unknown pair type');
      }
    }
    setupOracleScope.close();
    return deploymentResult;
  }

  private async deployAndConfigurePythOracle(
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
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);

    for (const setting of config.settings) {
      if (isSinglePairPythOracleConfig(setting)) {
        const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
        const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);

        const pair = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());

        if (!BigNumber.from(pair.maxPriceAge).eq(setting.maxPriceAge.toSeconds())) {
          // oracle already initialized

          const tx = await priceOracle.setPair(
            quoteToken.toString(),
            baseToken.toString(),
            setting.pythPriceId,
            setting.maxPriceAge.toSeconds()
          );
          await tx.wait();
        }

        await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
      } else if (isDoublePairPythOracleConfig(setting)) {
        const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
        const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
        const { address: intermediateToken } = tokenRepository.getTokenInfo(setting.intermediateToken.id);

        let tx = await priceOracle.setPair(
          intermediateToken.toString(),
          quoteToken.toString(),
          setting.quotePythPriceId.toString()
        );
        await tx.wait();
        tx = await priceOracle.setPair(
          intermediateToken.toString(),
          baseToken.toString(),
          setting.basePythPriceId.toString()
        );
        await tx.wait();
        tx = await priceOracle.setCompositePair(
          quoteToken.toString(),
          intermediateToken.toString(),
          baseToken.toString()
        );
        await tx.wait();

        await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
      } else {
        throw new Error('Unknown pair type');
      }
    }
    setupOracleScope.close();
    return deploymentResult;
  }

  private async deployAndConfigurePendleOracle(
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
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);
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

      await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
    }
    setupOracleScope.close();
    return deploymentResult;
  }

  private async deployAndConfigurePendleMarketOracle(
    config: PendleMarketOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'PendleMarketOracle',
      [config.pendlePtLpOracle.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );

    const priceOracle = (await deploymentResult).contract;
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);
    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);

      const currentParams = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());

      if (currentParams.secondsAgo != 0) continue; // oracle already initialized

      const tx = await priceOracle.setPair(
        quoteToken.toString(),
        baseToken.toString(),
        setting.pendleMarket.toString(),
        setting.secondsAgo.toSeconds(),
        setting.secondsAgoLiquidation.toSeconds()
      );
      await tx.wait();

      await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
    }
    setupOracleScope.close();
    return deploymentResult;
  }

  private async deployAlgebraOracle(
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
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);

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

      await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
    }
    setupOracleScope.close();
    return deploymentResult;
  }

  private async deployAlgebraDoubleOracle(
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
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);

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

      await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
    }

    setupOracleScope.close();
    return deploymentResult;
  }
  private async deployCurveOracle(config: CurveOracleConfig, tokenRepository: ITokenRepository): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'CurveOracle',
      [],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );
    const priceOracle = (await deploymentResult).contract;

    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);
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
    }
    setupOracleScope.close();
    return deploymentResult;
  }

  private async deployCompositeOracle(
    config: MarginlyCompositeOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'MarginlyCompositeOracle',
      [],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );
    const priceOracle = (await deploymentResult).contract;
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);

    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: intermediateToken } = tokenRepository.getTokenInfo(setting.intermediateToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);

      const currentParams = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());

      if (currentParams.intermediateToken.toLowerCase() !== intermediateToken.toString().toLowerCase()) {
        this.logger.log(`Add setting ${setting.baseToken.id}/${setting.quoteToken.id}`);

        const quoteIntermediateOracle = this.getRequiredPriceOracle(setting.quoteIntermediateOracleId);
        const baseIntermediateOracle = this.getRequiredPriceOracle(setting.intermediateBaseOracleId);

        const tx = await priceOracle.setPair(
          quoteToken.toString(),
          intermediateToken.toString(),
          baseToken.toString(),
          quoteIntermediateOracle.address,
          baseIntermediateOracle.address
        );
        await tx.wait();

        await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
      }
    }

    setupOracleScope.close();

    return deploymentResult;
  }

  private async deployPriceOracleProxy(
    config: PriceOracleProxyConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'PriceOracleProxy',
      [],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );
    const priceOracle = (await deploymentResult).contract;
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);

    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
      const { address: underlyingQuoteToken } = tokenRepository.getTokenInfo(setting.underlyingQuoteToken.id);
      const { address: underlyingBaseToken } = tokenRepository.getTokenInfo(setting.underlyingBaseToken.id);

      this.logger.log(`Add setting ${setting.baseToken.id}/${setting.quoteToken.id}`);

      const currentParams = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());

      if (currentParams.baseToken.toLowerCase() !== baseToken.toString().toLowerCase()) {
        const underlyingPriceOracle = this.getRequiredPriceOracle(setting.proxyOracleId);

        const tx = await priceOracle.setPair(
          quoteToken.toString(),
          baseToken.toString(),
          underlyingQuoteToken.toString(),
          underlyingBaseToken.toString(),
          underlyingPriceOracle.address
        );
        await tx.wait();

        await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
      }
    }

    setupOracleScope.close();

    return deploymentResult;
  }

  private async deployAavePriceOracle(
    config: AavePriceOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'AavePriceOracle',
      [config.aavePoolAddressesProvider.toString()],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );
    const priceOracle = (await deploymentResult).contract;
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);

    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);

      this.logger.log(`Add setting ${setting.baseToken.id}/${setting.quoteToken.id}`);

      const currentParams = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());

      if (!currentParams.initialized) {
        const tx = await priceOracle.setPair(quoteToken.toString(), baseToken.toString());
        await tx.wait();

        await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
      }
    }

    setupOracleScope.close();

    return deploymentResult;
  }

  private async deployEulerPriceOracle(
    config: EulerPriceOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    const deploymentResult = this.deploy(
      'EulerPriceOracle',
      [],
      `priceOracle_${config.id}`,
      this.readMarginlyPeripheryOracleContract
    );
    const priceOracle = (await deploymentResult).contract;
    var setupOracleScope = this.logger.beginScope(`SetUp ${config.id}`);

    for (const setting of config.settings) {
      const { address: baseToken } = tokenRepository.getTokenInfo(setting.baseToken.id);
      const { address: quoteToken } = tokenRepository.getTokenInfo(setting.quoteToken.id);
      const eulerOracle = setting.eulerOracle.toString();

      const currentParams = await priceOracle.getParams(quoteToken.toString(), baseToken.toString());

      if (currentParams.toLowerCase() !== eulerOracle.toLowerCase()) {
        this.logger.log(`Add setting ${setting.baseToken.id}/${setting.quoteToken.id}`);
        const tx = await priceOracle.addPair(quoteToken.toString(), baseToken.toString(), eulerOracle);
        await tx.wait();
      }

      await this.checkOraclePrice(config.id, priceOracle, quoteToken.toString(), baseToken.toString());
    }

    setupOracleScope.close();

    return deploymentResult;
  }

  public async deployPriceOracle(
    priceOracle: PriceOracleConfig,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult> {
    let deploymentResult: DeployResult;
    if (isUniswapV3Oracle(priceOracle)) {
      deploymentResult = await this.deployAndConfigureUniswapV3TickOracle(priceOracle, tokenRepository);
    } else if (isUniswapV3DoubleOracle(priceOracle)) {
      deploymentResult = await this.deployAndConfigureUniswapV3TickDoubleOracle(priceOracle, tokenRepository);
    } else if (isChainlinkOracle(priceOracle)) {
      deploymentResult = await this.deployAndConfigureChainlinkOracle(priceOracle, tokenRepository);
    } else if (isPythOracle(priceOracle)) {
      deploymentResult = await this.deployAndConfigurePythOracle(priceOracle, tokenRepository);
    } else if (isPendleOracle(priceOracle)) {
      deploymentResult = await this.deployAndConfigurePendleOracle(priceOracle, tokenRepository);
    } else if (isPendleMarketOracle(priceOracle)) {
      deploymentResult = await this.deployAndConfigurePendleMarketOracle(priceOracle, tokenRepository);
    } else if (isAlgebraOracle(priceOracle)) {
      deploymentResult = await this.deployAlgebraOracle(priceOracle, tokenRepository);
    } else if (isAlgebraDoubleOracle(priceOracle)) {
      deploymentResult = await this.deployAlgebraDoubleOracle(priceOracle, tokenRepository);
    } else if (isCurveOracle(priceOracle)) {
      deploymentResult = await this.deployCurveOracle(priceOracle, tokenRepository);
    } else if (isMarginlyCompositeOracle(priceOracle)) {
      deploymentResult = await this.deployCompositeOracle(priceOracle, tokenRepository);
    } else if (isPriceOracleProxy(priceOracle)) {
      deploymentResult = await this.deployPriceOracleProxy(priceOracle, tokenRepository);
    } else if (isAavePriceOracle(priceOracle)) {
      deploymentResult = await this.deployAavePriceOracle(priceOracle, tokenRepository);
    } else if (isEulerPriceOracle(priceOracle)) {
      deploymentResult = await this.deployEulerPriceOracle(priceOracle, tokenRepository);
    } else {
      throw new Error(`Unknown priceOracle type`);
    }

    printDeployState(`${priceOracle.type} price oracle ${priceOracle.id}`, deploymentResult, this.logger);
    return deploymentResult;
  }
}
