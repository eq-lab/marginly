import { EthAddress } from '@marginly/common';
import { BigNumber, Signer } from 'ethers';
import { StateStore, readMarginlyAdapterContract, readMarginlyRouterContract } from '../common';
import { ITokenRepository, DeployResult } from '../common/interfaces';
import { BaseDeployer } from './BaseDeployer';
import {
  AdapterParam,
  MarginlyAdapterParam,
  PendleAdapterParam,
  PendleCurveAdapterParam,
  PendleCurveRouterAdapterParam,
  PendleMarketAdapterParam,
  PendlePtToAssetAdapterParam,
  isPendleAdapter,
  isPendleCurveAdapter,
  isPendleCurveRouterAdapter,
  isPendleMarketAdapter,
  isPendlePtToAssetAdapter,
} from './configs';
import { EthOptions } from '../config';
import { Logger } from '../logger';

export class MarginlyRouterDeployer extends BaseDeployer {
  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    super(signer, ethArgs, stateStore, logger);
  }

  public async deployMarginlyAdapter(
    tokenRepository: ITokenRepository,
    dexId: BigNumber,
    adapterName: string,
    pools: AdapterParam[],
    balancerVault?: EthAddress,
    curveRouter?: EthAddress
  ): Promise<DeployResult> {
    let args: any[];
    if (isPendleAdapter(pools[0])) {
      args = [
        pools.map((x) => {
          const locConfig = x as PendleAdapterParam;
          return [
            [
              locConfig.pendleMarket.toString(),
              locConfig.uniswapV3LikePool.toString(),
              tokenRepository.getTokenInfo(locConfig.ib.id).address.toString(),
              locConfig.slippage,
            ],
            tokenRepository.getTokenInfo(locConfig.token0.id).address.toString(),
            tokenRepository.getTokenInfo(locConfig.token1.id).address.toString(),
          ];
        }),
      ];
    } else if (isPendleMarketAdapter(pools[0])) {
      args = [
        pools.map((x) => {
          const locConfig = x as PendleMarketAdapterParam;
          return [
            locConfig.pendleMarket.toString(),
            locConfig.slippage,
            tokenRepository.getTokenInfo(locConfig.ptToken.id).address.toString(),
            tokenRepository.getTokenInfo(locConfig.ibToken.id).address.toString(),
          ];
        }),
      ];
    } else if (isPendlePtToAssetAdapter(pools[0])) {
      args = [
        pools.map((x) => {
          const locConfig = x as PendlePtToAssetAdapterParam;
          return [
            locConfig.pendleMarket.toString(),
            locConfig.slippage,
            tokenRepository.getTokenInfo(locConfig.ptToken.id).address.toString(),
            tokenRepository.getTokenInfo(locConfig.assetToken.id).address.toString(),
          ];
        }),
      ];
    } else if (isPendleCurveAdapter(pools[0])) {
      args = [
        pools.map((x) => {
          const locConfig = x as PendleCurveAdapterParam;
          return [
            locConfig.pendleMarket.toString(),
            locConfig.slippage,
            locConfig.curveSlippage,
            locConfig.curvePool.toString(),
            tokenRepository.getTokenInfo(locConfig.ibToken.id).address.toString(),
            tokenRepository.getTokenInfo(locConfig.quoteToken.id).address.toString(),
          ];
        }),
      ];
    } else if (isPendleCurveRouterAdapter(pools[0])) {
      if (!curveRouter) {
        throw new Error('CurveRouter address is required for PendleCurveRouterAdapter');
      }

      args = [
        curveRouter.toString(),
        pools.map((x) => {
          const locConfig = x as PendleCurveRouterAdapterParam;
          return [
            locConfig.pendleMarket.toString(),
            locConfig.slippage,
            locConfig.curveSlippage,
            locConfig.curveRoute.map((y) => y.toString()),
            locConfig.curveSwapParams,
            locConfig.curvePools.map((y) => y.toString()),
          ];
        }),
      ];
    } else {
      args = [
        pools.map((x) => {
          const locConfig = x as MarginlyAdapterParam;
          return [
            tokenRepository.getTokenInfo(locConfig.token0.id).address.toString(),
            tokenRepository.getTokenInfo(locConfig.token1.id).address.toString(),
            locConfig.pool.toString(),
          ];
        }),
      ];

      if (balancerVault !== undefined) {
        args.push(balancerVault.toString());
      }
    }

    const adapterDeployResult = await this.deploy(
      adapterName,
      args,
      `${adapterName}_${dexId}`,
      readMarginlyAdapterContract
    );
    await this.updateAdapterSettings(args);
    return adapterDeployResult;
  }

  private async updateAdapterSettings(args: any[]): Promise<void> {
    //TODO: check adapter for pools and update if needed

    console.log('Update adapter pools manually:');
    for (const arg of args) {
      console.log(arg);
    }

    console.log('\n\n');
  }

  public async deployMarginlyRouter(adapters: { dexId: BigNumber; adapter: EthAddress }[]): Promise<DeployResult> {
    const args = [adapters.map((x) => [x.dexId.toNumber(), x.adapter.toString()])];
    const deployResult = await this.deploy('MarginlyRouter', args, 'MarginlyRouter', readMarginlyRouterContract);

    const adaptersToAdd = [];
    const router = deployResult.contract;
    for (const adapter of adapters) {
      const routerAdapter = await router.adapters(adapter.dexId);
      if (routerAdapter.toString().toLowerCase() !== adapter.adapter.toString().toLowerCase()) {
        adaptersToAdd.push(adapter);

        this.logger.log(`Adapter dexId:${adapter.dexId} address:${adapter.adapter} should be added to MarginlyRouter`);
      }
    }

    if (adaptersToAdd.length > 0) {
      const adaptersToAddArgs = adaptersToAdd.map((x) => [x.dexId.toNumber(), x.adapter.toString()]);
      await router.connect(this.signer).addDexAdapters(adaptersToAddArgs);

      this.logger.log(`Added ${adaptersToAdd.length} adapters to MarginlyRouter`);
    }

    return deployResult;
  }
}
