import {expect} from 'chai';
import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
import {ethers} from 'hardhat';
import {TestUniswapV3PoolMock, Token, UniswapV3PoolMock, WETH9} from "../typechain-types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    priceToPriceFp18,
    priceToSqrtPriceX96,
    sortUniswapPoolTokens, twapFromTickCumulatives
} from '@marginly/common/math';

async function createToken(name: string, symbol: string, decimals: number = 18): Promise<Token> {
    const factory = await ethers.getContractFactory('Token');
    return await factory.deploy(name, symbol, decimals);
}

async function createWeth9(): Promise<WETH9> {
    const factory = await ethers.getContractFactory('WETH9');
    return await factory.deploy();
}

async function createTestUniswapV3PoolMock(oracle: string, tokenA: string, tokenB: string, fee: number): Promise<TestUniswapV3PoolMock> {
    const factory = await ethers.getContractFactory('TestUniswapV3PoolMock');
    return await factory.deploy(oracle, tokenA, tokenB, fee);
}

interface CreateContractResultTokens {
    arb: Token,
    weth: WETH9
}

interface CreateContractsResult {
    pool: TestUniswapV3PoolMock,
    tokens: CreateContractResultTokens,
    owner: SignerWithAddress,
    oracle: SignerWithAddress
}

async function createContracts(): Promise<CreateContractsResult> {
    const arbToken = await createToken('Arbitrum', 'ARB');
    const wethToken = await createWeth9();

    const fee = 500; // 0.05%

    const [owner, oracle] = await ethers.getSigners();

    const pool = await createTestUniswapV3PoolMock(oracle.address, arbToken.address, wethToken.address, fee);

    return {
        pool,
        tokens: {
            arb: arbToken,
            weth: wethToken
        },
        owner,
        oracle
    };
}

async function setPrice(pool: UniswapV3PoolMock, oracle: SignerWithAddress, tokens: [Token | WETH9, Token | WETH9], price: number) {
    const [tokenA, tokenB] = tokens;
    const [token0, token1] = sortUniswapPoolTokens(
        [tokenA.address as `0x${string}`, tokenB.address as `0x${string}`],
        [
            {
                symbol: await tokenA.symbol(),
                address: tokenA.address,
                decimals: await tokenA.decimals(),
                price: price
            },
            {
                symbol: await tokenB.symbol(),
                address: tokenB.address,
                decimals: await tokenB.decimals(),
                price: 1 / price
            }
        ]
    );

    const priceFp18 = priceToPriceFp18(token0.price, token0.decimals, token1.decimals);
    const sqrtPriceX96 = priceToSqrtPriceX96(token0.price, token0.decimals, token1.decimals);

    await pool.connect(oracle).setPrice(priceFp18, sqrtPriceX96);
}

describe('UniswapV3PoolMock', () => {
    interface PriceHistory {
        prices: number[],
        tokenPair: [keyof CreateContractResultTokens, keyof CreateContractResultTokens],
        tests: { secondsAgos: [number, number], expectedPrice: number }[]
    }

    const timestampStep = 1000;
    const priceHistories: PriceHistory[] = [
        {
            prices: [1, 4, 9, 16, 25],
            tokenPair: ['arb', 'weth'],
            tests: [
                {
                    secondsAgos: [timestampStep, 0],
                    expectedPrice: 16
                },
                {
                    secondsAgos: [2 * timestampStep, 0],
                    expectedPrice: 12
                },
                {
                    secondsAgos: [1.5 * timestampStep, 0.5 * timestampStep],
                    expectedPrice: 12
                }
            ]
        }
    ];

    priceHistories.forEach(({prices, tokenPair: [baseTokenKey, quoteTokenKey], tests}, priceHistoryNum) =>
        tests.forEach(({secondsAgos, expectedPrice}) =>
            it(`should calc observations properly for time range [${secondsAgos[0]}, ${secondsAgos[1]}] in prices history ${priceHistoryNum}`, async () => {
                const {
                    pool,
                    tokens,
                    owner,
                    oracle,
                } = await loadFixture(createContracts);

                const secondsInDay = 60 * 60 * 24;
                const startTimestamp = (Math.trunc(Date.now() / 1000 / secondsInDay) + 1) * secondsInDay;
                let currentTimestamp = startTimestamp;
                await pool.setTimestamp(currentTimestamp);

                const baseToken = tokens[baseTokenKey];
                const quoteToken = tokens[quoteTokenKey];
                await setPrice(pool, oracle, [baseToken, quoteToken], prices[0]);
                currentTimestamp += timestampStep;

                await pool.connect(owner).increaseObservationCardinalityNext(720);

                for (const price of prices.slice(1)) {
                    await pool.setTimestamp(currentTimestamp);
                    await setPrice(pool, oracle, [baseToken, quoteToken], price);
                    currentTimestamp += timestampStep;
                }

                const observations = (await pool.observe(secondsAgos));
                const tickCumulatives: [bigint, bigint] = [observations.tickCumulatives[0].toBigInt(), observations.tickCumulatives[1].toBigInt()];

                const [token0Decimals, token1Decimals] = sortUniswapPoolTokens([baseToken.address as `0x${string}`, quoteToken.address as `0x${string}`], [(await baseToken.decimals()), (await quoteToken.decimals())]);
                const actualPrice = twapFromTickCumulatives(tickCumulatives, [BigInt(secondsAgos[0]), BigInt(secondsAgos[1])], token0Decimals, token1Decimals);

                const expectedError = 0.0001;
                const actualError = Math.abs(actualPrice / expectedPrice - 1);

                expect(actualError).to.be.lte(expectedError);
            })
        )
    )
});