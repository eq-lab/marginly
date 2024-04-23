import { ethers } from 'hardhat';
import bn from 'bignumber.js';
import { BigNumber } from 'ethers';
import { PythOracle } from '../../typechain-types/contracts/oracles';

function toHumanPrice(priceX96: BigNumber, decimalsDiff: number) {
  const one = bn(2 ** 96);

  const multiplier = bn(10).pow(decimalsDiff);
  return bn(priceX96.toString()).times(multiplier).div(one.toString()).toString();
}

function printPrices(balancePrice: BigNumber, mcPrice: BigNumber, decimalsDiff: number) {
  console.log(`Balance price is ${toHumanPrice(balancePrice, decimalsDiff)}  (${balancePrice})`);
  console.log(`MC price is ${toHumanPrice(mcPrice, decimalsDiff)} (${mcPrice})`);
}

async function getDecimals(contractAddress: string): Promise<number> {
  const abi = ['function decimals() view returns (uint8)'];
  const contract = new ethers.Contract(contractAddress, abi, ethers.provider);
  return await contract.decimals();
}

async function getDecimalsDiff(quoteToken: string, baseToken: string): Promise<number> {
  const baseDecimals = await getDecimals(baseToken);
  const quoteDecimals = await getDecimals(quoteToken);
  return baseDecimals - quoteDecimals;
}

describe('PythOracle', () => {
  let oracle: PythOracle;
  before(async () => {
    const pythArbitrum = '0xff1a0f4744e8582df1ae09d5611b887b6a12925c';
    const factory = await ethers.getContractFactory('PythOracle');
    oracle = await factory.deploy(pythArbitrum);
  });

  it('composite (BTC/ETH)  BTC / USD; ETH / USD', async () => {
    const wbtc = '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f';
    const wbtcUsdPriceId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const ethUsdPriceId = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';

    const usdFake = '0x0000000000000000000000000000000000000000';

    await oracle.setPair(usdFake, wbtc, wbtcUsdPriceId);
    await oracle.setPair(usdFake, weth, ethUsdPriceId);
    await oracle.setCompositePair(weth, usdFake, wbtc);

    const balancePrice = await oracle.getBalancePrice(weth, wbtc);
    const mcPrice = await oracle.getMargincallPrice(weth, wbtc);

    const decimalsDiff = await getDecimalsDiff(weth, wbtc);
    printPrices(balancePrice, mcPrice, decimalsDiff);

    const revBalancePrice = await oracle.getBalancePrice(wbtc, weth);
    const revMcPrice = await oracle.getMargincallPrice(wbtc, weth);
    printPrices(revBalancePrice, revMcPrice, -decimalsDiff);
  });

  it('pair to USD: ETH / USD ', async () => {
    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const usdFake = '0x0000000000000000000000000000000000000000';
    const ethUsdPriceId = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';

    await oracle.setPair(usdFake, weth, ethUsdPriceId);

    const balancePrice = await oracle.getBalancePrice(usdFake, weth);
    const mcPrice = await oracle.getMargincallPrice(usdFake, weth);

    const decimalsDiff = 18;
    printPrices(balancePrice, mcPrice, decimalsDiff);

    const revBalancePrice = await oracle.getBalancePrice(weth, usdFake);
    const revMcPrice = await oracle.getMargincallPrice(weth, usdFake);
    printPrices(revBalancePrice, revMcPrice, -decimalsDiff);
  });
});
