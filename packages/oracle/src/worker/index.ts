import {
    CancellationTokenSource,
    Worker,
} from '@marginly/common/lifecycle';
import {Logger} from '@marginly/common/logger';
import {Executor, sleep} from '@marginly/common/execution';
import {using} from '@marginly/common/resource';
import {StrictConfig} from '../config';
import fetch from 'node-fetch';
import {priceToPriceFp18, priceToSqrtPriceX96, sortUniswapPoolTokens, sqrtPriceX96toPrice} from "@marginly/common/math";

class PriceGetter {
    private readonly executor: Executor;
    constructor(executor: Executor) {
        this.executor = executor;
    }

    public async getPriceInUsd(logger: Logger, baseSymbol: string): Promise<number> {
        const agentSymbol = 'usdt';
        const baseAgent = await this.fetchHuobyPrice(logger, baseSymbol, agentSymbol);
        const agentUsd = await this.fetchCryptoPrice(logger, agentSymbol, 'usd');

        return baseAgent * agentUsd;
    }

    public async getArbEthPrice(logger: Logger): Promise<number> {
        const arbUsdt = await this.fetchHuobyPrice(logger, 'arb', 'usdt');
        const ethUsdt = await this.fetchHuobyPrice(logger, 'eth', 'usdt');

        return arbUsdt / ethUsdt;
    }

    private async fetchHuobyPrice(logger: Logger, baseSymbol: string, quoteSymbol: string): Promise<number> {
        const url = `https://api.huobi.pro/market/history/trade?symbol=${baseSymbol}${quoteSymbol}&size=1`;
        return await using(logger.scope(`fetch-huobi-${baseSymbol}-${quoteSymbol}`, {
                baseSymbol,
                quoteSymbol,
                priceSource: 'huobi'
            }),
            async () => await this.fetchPrice(url, json => json.data[0].data[0].price)
        );
    }

    private async fetchCryptoPrice(logger: Logger, baseSymbol: string, quoteSymbol: string): Promise<number> {
        const url = `https://api.crypto.com/v2/public/get-ticker?instrument_name=${baseSymbol.toUpperCase()}_${quoteSymbol.toUpperCase()}`;
        return await using(logger.scope(`fetch-crypto-${baseSymbol}-${quoteSymbol}`, {
                baseSymbol,
                quoteSymbol,
                priceSource: 'crypto'
            }),
            async logger => await this.fetchPrice(url, json => json.result.data[0].a)
        );
    }

    private async fetchPrice(url: string, priceMapper: (json: any) => number): Promise<number> {

        return this.executor(async () => {
            const result = await fetch(url);

            if (!result.ok) {
                throw new Error(`Error fetching price`);
            }

            const json = await result.json();

            const price: number = priceMapper(json);

            if (isNaN(price)) {
                throw new Error('Price is not a number');
            }

            return price;
        });
    }
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
        executor: Executor
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

        this.logger.info('Start oracle worker');
        while (true) {
            if (cancellationToken.isCancelled()) {
                this.logger.info('Stopping oracle worker');
                break;
            }

            const priceGetter = new PriceGetter(this.executor);

            interface Token {
                symbol: string,
                decimals: number,
                address: `0x${string}`
            }

            const baseToken: Token = {
                symbol: 'arb',
                decimals: 18,
                address: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1'
            }
            const quoteToken: Token = {
                symbol: 'eth',
                decimals: 18,
                address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
            }

            const price = await using(this.logger.scope(`get-price-arb-eth`, {baseSymbol: baseToken.symbol, quoteSumbol: quoteToken.symbol}), async logger => {
                const price = await priceGetter.getArbEthPrice(logger);
                logger.info(`Current arb/eth price: ${price}`, {price});
                return price;
            });

            const [token0, token1] = sortUniswapPoolTokens([baseToken.address, quoteToken.address], [baseToken, quoteToken]);

            const priceFp18 = priceToPriceFp18(price, token0.decimals, token1.decimals);
            const sqrtPriceX96 = priceToSqrtPriceX96(price, token0.decimals, token1.decimals);

            this.logger.info(`Current arb/eth price: ${price}, fp18: ${priceFp18}, sqrtPriceX96: ${sqrtPriceX96}`);

            await sleep(
                2000
            );
        }
    }
}
