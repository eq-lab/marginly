import { ethers } from 'hardhat';
import { CurveEMAPriceOracle } from '../../typechain-types';
import { getDecimalsDiff, printPrices } from '../shared/common';

describe('Curve with EMA price oracle (CurveEMAPriceOracle)', () => {
  let oracle: CurveEMAPriceOracle;
  before(async () => {
    const factory = await ethers.getContractFactory('CurveEMAPriceOracle');
    oracle = await factory.deploy();
  });

  it('frxETH-WETH. WETH is quote', async () => {
    // pool - https://curve.fi/#/arbitrum/pools/factory-v2-140/deposit
    const pool = '0x1DeB3b1cA6afca0FF9C5cE9301950dC98Ac0D523';
    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const frxEth = '0x178412e79c25968a32e89b11f63B33F733770c2A';

    await oracle.addPool(pool, weth, frxEth);

    const balancePrice = await oracle.getBalancePrice(weth, frxEth);
    const mcPrice = await oracle.getMargincallPrice(weth, frxEth);

    const decimalsDiff = await getDecimalsDiff(weth, frxEth);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });

  it('frxETH-WETH. frxETH is quote', async () => {
    // pool - https://curve.fi/#/arbitrum/pools/factory-v2-140/deposit
    const pool = '0x1DeB3b1cA6afca0FF9C5cE9301950dC98Ac0D523';
    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const frxEth = '0x178412e79c25968a32e89b11f63B33F733770c2A';

    await oracle.addPool(pool, frxEth, weth);

    const balancePrice = await oracle.getBalancePrice(frxEth, weth);
    const mcPrice = await oracle.getMargincallPrice(frxEth, weth);

    const decimalsDiff = await getDecimalsDiff(frxEth, weth);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });

  it('tBTC-WBTC. WBTC is quote', async () => {
    // pool - https://curve.fi/#/arbitrum/pools/factory-v2-98/deposit
    const pool = '0x755D6688AD74661Add2FB29212ef9153D40fcA46';
    const tbtc = '0x6c84a8f1c29108F47a79964b5Fe888D4f4D0dE40';
    const wbtc = '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';

    await oracle.addPool(pool, wbtc, tbtc);

    const balancePrice = await oracle.getBalancePrice(wbtc, tbtc);
    const mcPrice = await oracle.getMargincallPrice(wbtc, tbtc);

    const decimalsDiff = await getDecimalsDiff(wbtc, tbtc);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });

  it('tBTC-WBTC. tBTC is quote', async () => {
    // pool - https://curve.fi/#/arbitrum/pools/factory-v2-98/deposit
    const pool = '0x755D6688AD74661Add2FB29212ef9153D40fcA46';
    // TBTC decimals = 18
    const tbtc = '0x6c84a8f1c29108F47a79964b5Fe888D4f4D0dE40';
    // WBTC decimals = 8
    const wbtc = '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';

    await oracle.addPool(pool, tbtc, wbtc);

    const balancePrice = await oracle.getBalancePrice(tbtc, wbtc);
    const mcPrice = await oracle.getMargincallPrice(tbtc, wbtc);

    const decimalsDiff = await getDecimalsDiff(tbtc, wbtc);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });

  it('FXN-WETH. WETH is quote', async () => {
    // pool - https://curve.fi/#/arbitrum/pools/factory-twocrypto-3/deposit
    const pool = '0x5f0985A8aAd85e82fD592a23Cc0501e4345fb18c';
    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const fxn = '0x179F38f78346F5942E95C5C59CB1da7F55Cf7CAd';

    await oracle.addPool(pool, weth, fxn);

    const balancePrice = await oracle.getBalancePrice(weth, fxn);
    const mcPrice = await oracle.getMargincallPrice(weth, fxn);

    const decimalsDiff = await getDecimalsDiff(weth, fxn);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });

  it('FXN-WETH. FXN is quote', async () => {
    // pool - https://curve.fi/#/arbitrum/pools/factory-twocrypto-3/deposit
    const pool = '0x5f0985A8aAd85e82fD592a23Cc0501e4345fb18c';
    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const fxn = '0x179F38f78346F5942E95C5C59CB1da7F55Cf7CAd';

    await oracle.addPool(pool, fxn, weth);

    const balancePrice = await oracle.getBalancePrice(fxn, weth);
    const mcPrice = await oracle.getMargincallPrice(fxn, weth);

    const decimalsDiff = await getDecimalsDiff(fxn, weth);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });
});
