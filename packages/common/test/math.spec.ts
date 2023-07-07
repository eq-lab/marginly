import { expect } from 'chai';
import { priceToPriceFp18, priceToSqrtPriceX96 } from '../src/math';

describe('math', () => {
  const priceFp18ConversionCases = [
    {
      baseDecimals: 18,
      quoteDecimals: 6,
      price: 1800,
      expectedPrice: 1800n * (10n ** 6n),
    },
    {
      baseDecimals: 6,
      quoteDecimals: 18,
      price: 1 / 2000,
      expectedPrice: 5n * (10n ** 26n),
    },
    {
      baseDecimals: 18,
      quoteDecimals: 18,
      price: 50,
      expectedPrice: 50n * (10n ** 18n),
    },
    {
      baseDecimals: 18,
      quoteDecimals: 18,
      price: 1 / 8,
      expectedPrice: 125n * (10n ** 15n),
    },
  ];

  priceFp18ConversionCases.forEach(({ baseDecimals, quoteDecimals, price, expectedPrice }) => {
      it(`should convert price to Fp18 for price: ${price}, baseDecimals: ${baseDecimals}, quoteDecimals: ${quoteDecimals}`, () => {
        const actualPrice = priceToPriceFp18(price, baseDecimals, quoteDecimals);
        expect(actualPrice).to.equal(expectedPrice);
      });
    },
  );

  it('should convert real word price to sqrtPriceX96', () => {
    const price = 0.0005483482514447399;
    const actual = priceToSqrtPriceX96(price, 6, 18);

    const expected = 1855272961248567614528147660745418n;

    let delta = actual - expected;
    if (delta < 0n) {
      delta = -delta;
    }

    const error = Number(delta) / Number(expected);

    expect(error).to.lessThan(1e-15);
  });

  const priceX96ConversionCases = [
    {
      baseDecimals: 18,
      quoteDecimals: 6,
      price: 1024,
      expectedPrice: 32n * (2n ** 96n) / (10n ** 6n),
    },
    {
      baseDecimals: 6,
      quoteDecimals: 18,
      price: 1 / 1024,
      expectedPrice: (10n ** 6n) * (2n ** 96n) / 32n,
    },
    {
      baseDecimals: 18,
      quoteDecimals: 18,
      price: 16,
      expectedPrice: 4n * (2n ** 96n),
    },
    {
      baseDecimals: 18,
      quoteDecimals: 18,
      price: 1 / 4,
      expectedPrice: (2n ** 96n) / 2n,
    },
  ];

  priceX96ConversionCases.forEach(({ baseDecimals, quoteDecimals, price, expectedPrice }) => {
      it(`should convert price to X96 for price: ${price}, baseDecimals: ${baseDecimals}, quoteDecimals: ${quoteDecimals}`, () => {
        const actualPrice = priceToSqrtPriceX96(price, baseDecimals, quoteDecimals);

        let delta = actualPrice - expectedPrice;
        if (delta < 0n) {
          delta = -delta;
        }

        const error = Number(delta) / Number(expectedPrice);

        expect(error).to.lessThan(1e-16);
      });
    },
  );

  const exchangeCases = [
    {
      baseDecimals: 18,
      quoteDecimals: 6,
      price: 1800,
      baseAmount: [2n, 1n],
      expectedQuoteAmount: [3600n, 1n],
    },
    {
      baseDecimals: 6,
      quoteDecimals: 18,
      price: 0.0005,
      baseAmount: [3000n, 1n],
      expectedQuoteAmount: [3n, 2n],
    },
    {
      baseDecimals: 18,
      quoteDecimals: 18,
      price: 1800,
      baseAmount: [2n, 1n],
      expectedQuoteAmount: [3600n, 1n],
    },
    {
      baseDecimals: 18,
      quoteDecimals: 18,
      price: 0.0005,
      baseAmount: [3000n, 1n],
      expectedQuoteAmount: [3n, 2n],
    },
  ];

  exchangeCases.forEach(({ baseDecimals, quoteDecimals, price, baseAmount, expectedQuoteAmount }) => {
    const priceDecimals = 18n;
    const priceOne = 10n ** priceDecimals;

    const baseAmountNumber = Number(baseAmount[0]) / Number(baseAmount[1]);

    it(`should exchange ${baseAmountNumber} for price ${price}, base decimals: ${baseDecimals}, quote decimals: ${quoteDecimals}`, () => {
      const actualPrice = priceToPriceFp18(price, baseDecimals, quoteDecimals);

      const baseOne = 10n ** BigInt(baseDecimals);
      const quoteOne = 10n ** BigInt(quoteDecimals);

      const baseAmountFp18 = baseAmount[0] * baseOne / baseAmount[1];

      const expectedQuoteFp18Amount = expectedQuoteAmount[0] * quoteOne / expectedQuoteAmount[1];

      const actualQuoteFp18Amount = baseAmountFp18 * actualPrice / priceOne;

      expect(actualQuoteFp18Amount).to.equal(expectedQuoteFp18Amount);
    });
  });
});