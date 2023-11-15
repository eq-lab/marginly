import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { createMarginlyPoolWithPriceAdapter } from '@marginly/contracts/test/shared/fixtures';
import { FP96, mulFp96 } from '@marginly/contracts/test/shared/utils';
import bn from 'bignumber.js';
import { expect } from 'chai';

const btc = { price: 3567890123456n, decimals: 8n };
const eth = { price: 1987654321090123456789n, decimals: 18n };
const pepe = { price: 1176000000000n, decimals: 18n };

describe('PriceAdapter', () => {
  it('price in marginly equals to price in adapter for direct pair price', async () => {
    const base = pepe;
    const { marginlyPoolWithPriceAdapter, chainlinkAggregatorBase, priceAdapter } = await loadFixture(
      createMarginlyPoolWithPriceAdapter(base, null)
    );
    const delta = 15 * 60;

    const [, basePrice] = await chainlinkAggregatorBase.latestRoundData();

    console.log('base', basePrice);

    const [adapterBasePrice] = await priceAdapter.getScaledPrices();
    console.log('adapter', adapterBasePrice);

    // Q96
    const marginlySqrtPriceX96 = await marginlyPoolWithPriceAdapter.getTwapPrice(delta);
    const priceFromMarginlyX96 = mulFp96(marginlySqrtPriceX96, marginlySqrtPriceX96);
    const priceFromMarginly = priceFromMarginlyX96.mul(10n ** base.decimals).div(FP96.one);
    console.log('priceFromMarginly', priceFromMarginly);

    const diff = priceFromMarginly.sub(adapterBasePrice).abs();
    const relative_diff = bn(diff.toString()).div(adapterBasePrice.toString());
    console.log(
      'diff:',
      bn(diff.toString())
        .div((10n ** base.decimals).toString())
        .toString(),
      'diff %:',
      relative_diff.toString()
    );
    expect(relative_diff.lt(bn(0.0001))).to.be.true;
  });

  it('price in marginly equals to price in adapter for no direct pair price', async () => {
    const base = btc;
    const quote = eth;
    const { marginlyPoolWithPriceAdapter, chainlinkAggregatorBase, chainlinkAggregatorQuote, priceAdapter } =
      await loadFixture(createMarginlyPoolWithPriceAdapter(base, quote));
    const delta = 15 * 60;

    const [, basePrice] = await chainlinkAggregatorBase.latestRoundData();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, quotePrice] = await chainlinkAggregatorQuote!.latestRoundData();

    console.log('basePrice ', basePrice);
    console.log('quotePrice', quotePrice);

    // sqrt price
    const adapterSqrt96Price = await priceAdapter.getSqrtPriceX96();
    console.log('adapterSqrt96Price', adapterSqrt96Price);

    const [adapterBasePrice, adapterQuotePrice] = await priceAdapter.getScaledPrices();
    const decimals = base.decimals > quote.decimals ? base.decimals : quote.decimals;
    const adapterPrice = adapterBasePrice.mul(10n ** decimals).div(adapterQuotePrice);
    console.log('adapter', adapterPrice);

    // Q96
    const marginlySqrtPriceX96 = await marginlyPoolWithPriceAdapter.getTwapPrice(delta);
    const priceFromMarginlyX96 = mulFp96(marginlySqrtPriceX96, marginlySqrtPriceX96);
    const priceFromMarginly = priceFromMarginlyX96.mul(10n ** decimals).div(FP96.one);
    console.log('priceFromMarginly', priceFromMarginly);

    const diff = priceFromMarginly.sub(adapterPrice).abs();
    const relative_diff = bn(diff.toString()).div(adapterPrice.toString());
    console.log('diff:', bn(diff.toString()).div(decimals.toString()).toString(), 'diff %:', relative_diff.toString());
    expect(relative_diff.lt(bn(0.0001))).to.be.true;
  });
});
