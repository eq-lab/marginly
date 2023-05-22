import { expect } from 'chai';
import {
  sortUniswapPoolTokens, twapFromTickCumulatives,
} from '@marginly/common/math';
import { Wallet, Provider, Contract } from 'zksync-web3';
import * as hre from 'hardhat';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { createTestUniswapV3PoolMock, createToken, createWeth9, richWalletPks, setPrice } from './common';

interface CreateContractResultTokens {
  arb: Contract,
  weth: Contract
}

interface CreateContractsResult {
  pool: Contract,
  tokens: CreateContractResultTokens,
  owner: Wallet,
  oracle: Wallet
}

async function createContracts(provider: Provider, deployer: Deployer): Promise<CreateContractsResult> {
  const arbToken = await createToken(deployer, 'Arbitrum', 'ARB');
  const wethToken = await createWeth9(deployer);

  const fee = 500; // 0.05%

  const [owner, oracle] = richWalletPks.map(x => new Wallet(x, provider));

  const pool = await createTestUniswapV3PoolMock(deployer, oracle.address, arbToken.address, wethToken.address, fee);

  return {
    pool,
    tokens: {
      arb: arbToken,
      weth: wethToken,
    },
    owner,
    oracle,
  };
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
          expectedPrice: 16,
        },
        {
          secondsAgos: [2 * timestampStep, 0],
          expectedPrice: 12,
        },
        {
          secondsAgos: [1.5 * timestampStep, 0.5 * timestampStep],
          expectedPrice: 12,
        },
      ],
    },
  ];

  priceHistories.forEach(({ prices, tokenPair: [baseTokenKey, quoteTokenKey], tests }, priceHistoryNum) =>
    tests.forEach(({ secondsAgos, expectedPrice }) =>
      it(`should calc observations properly for time range [${secondsAgos[0]}, ${secondsAgos[1]}] in prices history ${priceHistoryNum}`, async () => {
        const provider = Provider.getDefaultProvider();
        const wallet = new Wallet(richWalletPks[0], provider);
        const deployer = new Deployer(hre, wallet);

        const {
          pool,
          tokens,
          owner,
          oracle,
        } = await createContracts(provider, deployer);

        const secondsInDay = 60 * 60 * 24;
        const startTimestamp = (Math.trunc(Date.now() / 1000 / secondsInDay) + 1) * secondsInDay;
        let currentTimestamp = startTimestamp;
        await (await pool.setTimestamp(currentTimestamp)).wait();
        // await sleep(2000);

        const baseToken = tokens[baseTokenKey];
        const quoteToken = tokens[quoteTokenKey];
        await setPrice(pool, oracle, [baseToken, quoteToken], prices[0]);
        currentTimestamp += timestampStep;
        // await sleep(2000);

        await (await pool.connect(owner).increaseObservationCardinalityNext(720)).wait();

        for (const price of prices.slice(1)) {
          await (await pool.setTimestamp(currentTimestamp)).wait();
          // await sleep(2000);
          await setPrice(pool, oracle, [baseToken, quoteToken], price);
          // await sleep(2000);
          currentTimestamp += timestampStep;
        }
        await (await pool.setTimestamp(currentTimestamp)).wait();

        const observations = (await pool.observe(secondsAgos));
        const tickCumulatives: [bigint, bigint] = [observations.tickCumulatives[0].toBigInt(), observations.tickCumulatives[1].toBigInt()];

        const [token0Decimals, token1Decimals] = sortUniswapPoolTokens([baseToken.address as `0x${string}`, quoteToken.address as `0x${string}`], [(await baseToken.decimals()), (await quoteToken.decimals())]);
        const actualPrice = twapFromTickCumulatives(tickCumulatives, [BigInt(secondsAgos[0]), BigInt(secondsAgos[1])], token0Decimals, token1Decimals);

        const expectedError = 0.0001;
        const actualError = Math.abs(actualPrice / expectedPrice - 1);

        // console.log({
        //   baseTokenAddress: baseToken.address,
        //   quoteTokenAddress: quoteToken.address,
        //   expectedPrice,
        //   actualPrice,
        //   expectedError,
        //   actualError,
        //   range: secondsAgos,
        //   tickCumulatives
        // });

        expect(actualError).to.be.lte(expectedError);
      }),
    ),
  );
});