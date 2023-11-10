import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { createMarginlyPoolWithPriceAdapter } from './shared/fixtures';
import { FP96, mulFp96 } from './shared/utils';
import bn from 'bignumber.js';
import { expect } from 'chai';

describe('PriceAdapter', () => {
  it('price in marginly equals to price in adapter for direct pair price', async () => {
    const { marginlyPoolWithPriceAdapter, chainlinkAggregatorBase, priceAdapter } = await loadFixture(
      createMarginlyPoolWithPriceAdapter(
        // {price: 1987654321090123456789n, decimals: 18n}, // eth
        { price: 3567890123456n, decimals: 8n }, // btc
        null
      )
    );
    const delta = 15*60;

    const [, basePrice] = await chainlinkAggregatorBase.latestRoundData();

    console.log('base', basePrice);

    const [adapterPrice, decimals] = await priceAdapter.getPrice();
    console.log('adapter', adapterPrice);

    // Q96
    const marginlySqrtPriceX96 = await marginlyPoolWithPriceAdapter.getTwapPrice(delta);
    const priceFromMarginlyX96 = mulFp96(marginlySqrtPriceX96, marginlySqrtPriceX96);
    const priceFromMarginly = priceFromMarginlyX96.mul(decimals).div(FP96.one);
    console.log('priceFromMarginly', priceFromMarginly);

    const diff = priceFromMarginly.sub(adapterPrice).abs();
    const relative_diff = bn(diff.toString()).div(adapterPrice.toString());
    console.log(
      'diff:',
      bn(diff.toString()).div(decimals.toString()).toString(),
      'diff %:',
      relative_diff.toString()
    );
    expect(relative_diff.lt(bn(0.0001))).to.be.true;
  });

  it('price in marginly equals to price in adapter for no direct pair price', async () => {
    const { marginlyPoolWithPriceAdapter, chainlinkAggregatorBase, chainlinkAggregatorQuote, priceAdapter } =
      await loadFixture(
        createMarginlyPoolWithPriceAdapter(
          { price: 3567890123456n, decimals: 8n }, // btc
          { price: 1987654321090123456789n, decimals: 18n } // eth
        )
      );
    const delta = 15*60;

    const [, basePrice] = await chainlinkAggregatorBase.latestRoundData();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, quotePrice] = await chainlinkAggregatorQuote!.latestRoundData();

    console.log('base', basePrice);
    console.log('quotePrice', quotePrice);

    const [adapterPrice, decimals] = await priceAdapter.getPrice();
    console.log('adapter', adapterPrice);

    // Q96
    const marginlySqrtPriceX96 = await marginlyPoolWithPriceAdapter.getTwapPrice(delta);
    const priceFromMarginlyX96 = mulFp96(marginlySqrtPriceX96, marginlySqrtPriceX96);
    const priceFromMarginly = priceFromMarginlyX96.mul(decimals).div(FP96.one);
    console.log('priceFromMarginly', priceFromMarginly);

    const diff = priceFromMarginly.sub(adapterPrice).abs();
    const relative_diff = bn(diff.toString()).div(adapterPrice.toString());
    console.log('diff:', bn(diff.toString()).div(decimals.toString()).toString(), 'diff %:', relative_diff.toString());
    expect(relative_diff.lt(bn(0.0001))).to.be.true;
  });
});
