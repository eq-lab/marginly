import {
  CancellationTokenSource,
  Worker,
} from '@marginly/common/lifecycle';
import { Logger } from '@marginly/common/logger';
import { Executor, sleep } from '@marginly/common/execution';
import { using } from '@marginly/common/resource';
import { StrictConfig, StrictTokenConfig, TokenConfig, UniswapV3PoolMockConfig } from '../config';
import {
  priceToPriceFp18,
  priceToSqrtPriceX96,
  sortUniswapPoolTokens,
  sqrtPriceX96toPrice,
} from '@marginly/common/math';
import { createPriceGetter, PriceGetter } from '@marginly/common/price';
import * as ethers from 'ethers';
import { ContractDescription, EthAddress } from '@marginly/common';
import { isFunction } from 'util';
import { number } from 'yargs';

function readUniswapMockContract(name: string): ContractDescription {
  return require(`@marginly/contracts-uniswap-mock/artifacts/contracts/${name}.sol/${name}.json`);
}

function readOpenzeppelinContract(name: string): ContractDescription {
  return require(`@openzeppelin/contracts/build/contracts/${name}.json`);
}

type Token = StrictTokenConfig & {
  contract: ethers.Contract,
  symbol: string,
  decimals: number
};

type PoolMock = UniswapV3PoolMockConfig & {
  contract: ethers.Contract,
  token0Address: EthAddress,
  token1Address: EthAddress,
}

export class OracleWorker implements Worker {
  private readonly cancellationTokenSource: CancellationTokenSource;

  private readonly config;
  private readonly logger;
  private readonly executor;

  private state?: {};

  public constructor(
    config: StrictConfig,
    logger: Logger,
    executor: Executor,
  ) {
    this.cancellationTokenSource = new CancellationTokenSource();

    this.config = config;
    this.logger = logger;
    this.executor = executor;
  }

  public requestStop(): void {
    this.logger.info('Stop requested');
    this.cancellationTokenSource.cancel();
  }

  public async run(): Promise<void> {
    const cancellationToken = this.cancellationTokenSource.getToken();

    this.state = {};

    const provider = new ethers.providers.JsonRpcProvider(this.config.ethereum.nodeUrl);

    const oracleSigner = new ethers.Wallet(this.config.ethereum.oraclePrivateKey).connect(provider);

    const tokenContractDescription = readOpenzeppelinContract('IERC20Metadata');

    const tokens = new Map<string, Token>();

    for (const tokenConfig of this.config.tokens) {
      const contract = new ethers.Contract(tokenConfig.address.toString(), tokenContractDescription.abi, provider);
      const symbol = await contract.symbol();
      const decimals = await contract.decimals();
      tokens.set(tokenConfig.id, { ...tokenConfig, contract, symbol, decimals });
    }

    const findTokenByAddress = (address: EthAddress): Token => {
      for (const token of tokens.values()) {
        if (token.address.compare(address) === 0) {
          return token;
        }
      }
      throw new Error(`Token with address ${address} not found`);
    };

    const priceGetters = new Map<string, PriceGetter>();

    for (const priceConfig of this.config.prices) {
      priceGetters.set(priceConfig.id, createPriceGetter(this.executor, priceConfig));
    }

    const uniswapV3PoolMockContractDescription = readUniswapMockContract('UniswapV3PoolMock');

    const poolMocks = new Map<string, PoolMock>();

    for (const poolMockConfig of this.config.uniswapV3PoolMocks) {
      const contract = new ethers.Contract(poolMockConfig.address, uniswapV3PoolMockContractDescription.abi, oracleSigner);
      const token0 = await contract.token0();
      const token1 = await contract.token1();
      poolMocks.set(poolMockConfig.id, {
        ...poolMockConfig,
        contract,
        token0Address: EthAddress.parse(token0),
        token1Address: EthAddress.parse(token1)
      });
    }

    this.logger.info('Start oracle worker');
    while (true) {
      if (cancellationToken.isCancelled()) {
        this.logger.info('Stopping oracle worker');
        break;
      }

      const currentPrices = new Map<string, number>();

      for (const [priceId, priceGetter] of priceGetters.entries()) {
        const price = await priceGetter.getPrice(this.logger);

        this.logger.info(`Price of ${priceId} is ${price}`);

        currentPrices.set(priceId, price);
      }

      for (const poolMock of poolMocks.values()) {
        const price = currentPrices.get(poolMock.priceId);

        if (price === undefined) {
          throw new Error(`Price ${poolMock.priceId} not found`);
        }

        const priceBaseToken = tokens.get(poolMock.priceBaseTokenId);

        if (priceBaseToken === undefined) {
          throw new Error(`Price base token ${poolMock.priceBaseTokenId} not found`);
        }

        const token0 = findTokenByAddress(poolMock.token0Address);
        const token1 = findTokenByAddress(poolMock.token1Address);

        let token0Price: number;
        if (token0.id === priceBaseToken.id) {
          token0Price = price;
        } else if (token1.id === priceBaseToken.id) {
          token0Price = 1 / price;
        } else {
          throw new Error(`Price base token ${priceBaseToken.id} is neither token0 nor token1`);
        }

        const priceFp18 = priceToPriceFp18(token0Price, token0.decimals, token1.decimals);
        const sqrtPriceX96 = priceToSqrtPriceX96(token0Price, token0.decimals, token1.decimals);
        this.logger.info(`About to set ${poolMock.priceId} price: ${token0Price}, fp18: ${priceFp18}, sqrtPriceX96: ${sqrtPriceX96} to ${poolMock.id} pool mock`);

        await poolMock.contract.setPrice(priceFp18, sqrtPriceX96);
      }

      await sleep(
        50_000,
      );
    }
  }
}
