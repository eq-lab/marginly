import { MarginlyConfigExistingToken, MarginlyConfigMintableToken, MarginlyConfigToken, TimeSpan } from '../common';
import { EthAddress, RationalNumber } from '@marginly/common';
import {
  Dex,
  EthConnectionConfig,
  isMarginlyDeployConfigExistingToken,
  isMarginlyDeployConfigMintableToken,
  isMarginlyDeployConfigUniswapGenuine,
  isMarginlyDeployConfigUniswapMock,
  MarginlyDeployConfig,
} from '../config';
import { adapterWriter, Logger } from '../logger';
import { createRootLogger, textFormatter } from '@marginly/logger';
import { timeoutRetry } from '@marginly/common/execution';
import { CriticalError } from '@marginly/common/error';
import { createPriceGetter } from '@marginly/common/price';

export interface MarginlyConfigUniswapPoolGenuine {
  type: 'genuine';
  id: string;
  tokenA: MarginlyConfigToken;
  tokenB: MarginlyConfigToken;
  fee: RationalNumber;
  allowCreate: boolean;
  assertAddress?: EthAddress;
}

export interface MarginlyConfigUniswapGenuine {
  type: 'genuine';
  factory: EthAddress;
  pools: MarginlyConfigUniswapPoolGenuine[];
}

export interface MarginlyConfigUniswapPoolMock {
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

export interface MarginlyConfigUniswapMock {
  type: 'mock';
  oracle: EthAddress;
  weth9Token: MarginlyConfigToken;
  priceLogSize: number;
  pools: MarginlyConfigUniswapPoolMock[];
}

export type MarginlyConfigUniswap = MarginlyConfigUniswapGenuine | MarginlyConfigUniswapMock;

export function isMarginlyConfigUniswapGenuine(
  uniswap: MarginlyConfigUniswap
): uniswap is MarginlyConfigUniswapGenuine {
  return uniswap.type === 'genuine';
}

export function isMarginlyConfigUniswapMock(uniswap: MarginlyConfigUniswap): uniswap is MarginlyConfigUniswapMock {
  return uniswap.type === 'mock';
}

export type MarginlyConfigUniswapPool = MarginlyConfigUniswapPoolGenuine | MarginlyConfigUniswapPoolMock;

export function isMarginlyConfigUniswapPoolGenuine(
  uniswapPool: MarginlyConfigUniswapPool
): uniswapPool is MarginlyConfigUniswapPoolGenuine {
  return uniswapPool.type === 'genuine';
}

export function isMarginlyConfigUniswapPoolMock(
  uniswapPool: MarginlyConfigUniswapPool
): uniswapPool is MarginlyConfigUniswapPoolMock {
  return uniswapPool.type === 'mock';
}

export interface MarginlyFactoryConfig {
  feeHolder: EthAddress;
  techPositionOwner: EthAddress;
  weth9Token: MarginlyConfigToken;
}

export interface MarginlyPoolParams {
  interestRate: RationalNumber;
  fee: RationalNumber;
  maxLeverage: RationalNumber;
  swapFee: RationalNumber;
  priceAgo: TimeSpan;
  positionSlippage: RationalNumber;
  mcSlippage: RationalNumber;
  positionMinAmount: RationalNumber;
  baseLimit: RationalNumber;
  quoteLimit: RationalNumber;
}

export interface MarginlyConfigMarginlyPool {
  id: string;
  uniswapPool: MarginlyConfigUniswapPool;
  baseToken: MarginlyConfigToken;
  quoteToken: MarginlyConfigToken;
  params: MarginlyPoolParams;
}

export interface MarginlyRouterConstructorParam {
  dex: Dex;
  token0: MarginlyConfigToken;
  token1: MarginlyConfigToken;
  pool: EthAddress;
}

export interface MarginlyConfigMarginlyRouter {
  pools: MarginlyRouterConstructorParam[];
  balancerVault: EthAddress;
}

export interface MarginlyConfigMarginlyKeeper {
  aavePoolAddressesProvider: {
    address?: EthAddress;
    allowCreateMock?: boolean;
  };
}

export class StrictMarginlyDeployConfig {
  public readonly connection: EthConnectionConfig;
  public readonly tokens: MarginlyConfigToken[];
  public readonly uniswap: MarginlyConfigUniswap;
  public readonly marginlyFactory: MarginlyFactoryConfig;
  public readonly marginlyPools: MarginlyConfigMarginlyPool[];
  public readonly marginlyKeeper: MarginlyConfigMarginlyKeeper;
  public readonly marginlyRouter: MarginlyConfigMarginlyRouter;

  private constructor(
    connection: EthConnectionConfig,
    uniswap: MarginlyConfigUniswap,
    marginlyFactory: MarginlyFactoryConfig,
    tokens: MarginlyConfigToken[],
    marginlyPools: MarginlyConfigMarginlyPool[],
    marginlyKeeper: MarginlyConfigMarginlyKeeper,
    marginlyRouter: MarginlyConfigMarginlyRouter
  ) {
    this.connection = connection;
    this.uniswap = uniswap;
    this.marginlyFactory = marginlyFactory;
    this.tokens = tokens;
    this.marginlyPools = marginlyPools;
    this.marginlyKeeper = marginlyKeeper;
    this.marginlyRouter = marginlyRouter;
  }

  public static async fromConfig(logger: Logger, config: MarginlyDeployConfig): Promise<StrictMarginlyDeployConfig> {
    const tokens = new Map<string, MarginlyConfigToken>();
    for (let i = 0; i < config.tokens.length; i++) {
      const rawToken = config.tokens[i];

      if (tokens.has(rawToken.id)) {
        throw new Error(`Duplicate token id ${rawToken.id} at index ${i}`);
      }

      if (isMarginlyDeployConfigExistingToken(rawToken)) {
        const token: MarginlyConfigExistingToken = {
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
    const routerPools: MarginlyRouterConstructorParam[] = [];

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
        const assertAddress = rawPool.assertAddress === undefined ? undefined : EthAddress.parse(rawPool.assertAddress);

        const pool: MarginlyConfigUniswapPoolGenuine = {
          type: 'genuine',
          id: rawPool.id,
          tokenA,
          tokenB,
          fee,
          allowCreate: rawPool.allowCreate,
          assertAddress: assertAddress,
        };
        uniswapPools.set(rawPool.id, pool);
        genuinePools.push(pool);
      }
      uniswap = {
        type: 'genuine',
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
        throw new Error(
          `Base token with id '${baseToken.id}' of marginly pool '${rawPool.id}' not found in uniswap pool '${uniswapPool.id}'`
        );
      }

      const quoteToken = uniswapPool.tokenA.id === baseToken.id ? uniswapPool.tokenB : uniswapPool.tokenA;

      const params: MarginlyPoolParams = {
        interestRate: RationalNumber.parsePercent(rawPool.params.interestRate),
        fee: RationalNumber.parsePercent(rawPool.params.fee),
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
        `Config error. You should either provide address of aavePoolAddressesProvider or set flag allowCreateMock`
      );
    }

    if (!EthAddress.isValidAddress(config.router.balancerVault)) {
      throw new Error(
        `Config error. You should either provide address of aavePoolAddressesProvider or set flag allowCreateMock`
      );
    }
    const marginlyRouter: MarginlyConfigMarginlyRouter = {
      pools: routerPools,
      balancerVault: EthAddress.parse(config.router.balancerVault),
    };

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
        techPositionOwner: EthAddress.parse(config.marginlyFactory.techPositionOwner),
        weth9Token: wethToken,
      },
      Array.from(tokens.values()),
      marginlyPools,
      marginlyKeeper,
      marginlyRouter
    );
  }
}
