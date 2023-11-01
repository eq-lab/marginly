import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { createMarginlyPoolWithTraderJoeV2PriceAdapter } from './shared/fixtures';
import { FP128 } from './shared/utils';
import { expect } from 'chai';

describe.skip('TraderJoev2PriceAdapter', () => {
  it('price in marginly equal to TJ v2 price', async () => {
    const { traderJoeV2, marginlyPoolWithPriceAdapter } = await loadFixture(
      createMarginlyPoolWithTraderJoeV2PriceAdapter
    );
    const delta = 80;
    // Q128
    // const price = await traderJoeV2._getPriceFromId(8375175);
    // console.log(price);
    // console.log(price.div(FP128.one));
    const twapFromJoeQ128 = await traderJoeV2.getTWAP(delta);
    const twapFromJoe = twapFromJoeQ128.div(FP128.one);
    console.log(twapFromJoe);
    // // Q96
    // const twapFromMarginlyQ96 = await marginlyPoolWithPriceAdapter.getTwapPrice(delta);
    // const twapFromMarginly = twapFromMarginlyQ96.div(twapFromMarginlyQ96);
    // console.log(twapFromJoe, twapFromMarginly);

    expect(false);
  });
});
