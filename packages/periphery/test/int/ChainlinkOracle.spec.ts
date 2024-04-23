import { ethers } from 'hardhat';
import bn from 'bignumber.js';
import { BigNumber } from 'ethers';
import { ChainlinkOracle } from '../../typechain-types/contracts/oracles';

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

describe('ChainlinkOracle', () => {
  let oracle: ChainlinkOracle;
  before(async () => {
    const factory = await ethers.getContractFactory('ChainlinkOracle');
    oracle = await factory.deploy();
  });

  it('composite (BTC/ETH)  BTC / USD; ETH / USD', async () => {
    const wbtc = '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f';
    const wbtcUsdDataFeed = '0xd0C7101eACbB49F3deCcCc166d238410D6D46d57';
    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const wethUsdDataFeed = '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612';
    const usdFake = '0x0000000000000000000000000000000000000000';

    await oracle.setPair(usdFake, wbtc, wbtcUsdDataFeed);
    await oracle.setPair(usdFake, weth, wethUsdDataFeed);
    await oracle.setCompositePair(weth, usdFake, wbtc);

    const balancePrice = await oracle.getBalancePrice(weth, wbtc);
    const mcPrice = await oracle.getMargincallPrice(weth, wbtc);

    const decimalsDiff = await getDecimalsDiff(weth, wbtc);
    printPrices(balancePrice, mcPrice, decimalsDiff);

    const revBalancePrice = await oracle.getBalancePrice(wbtc, weth);
    const revMcPrice = await oracle.getMargincallPrice(wbtc, weth);
    printPrices(revBalancePrice, revMcPrice, -decimalsDiff);
  });

  it('simple pair LINK / ETH', async () => {
    const link = '0xf97f4df75117a78c1a5a0dbb814af92458539fb4';
    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const linkEthDataFeed = '0xb7c8Fb1dB45007F98A68Da0588e1AA524C317f27';

    await oracle.setPair(weth, link, linkEthDataFeed);

    const balancePrice = await oracle.getBalancePrice(weth, link);
    const mcPrice = await oracle.getMargincallPrice(weth, link);

    const decimalsDiff = await getDecimalsDiff(weth, link);
    printPrices(balancePrice, mcPrice, decimalsDiff);

    const revBalancePrice = await oracle.getBalancePrice(link, weth);
    const revMcPrice = await oracle.getMargincallPrice(link, weth);
    printPrices(revBalancePrice, revMcPrice, -decimalsDiff);
  });

  it('pair to USD: BTC / USD ', async () => {
    const wbtc = '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f';
    const wbtcUsdDataFeed = '0xd0C7101eACbB49F3deCcCc166d238410D6D46d57';
    const usdFake = '0x0000000000000000000000000000000000000000';

    await oracle.setPair(usdFake, wbtc, wbtcUsdDataFeed);
    const balancePrice = await oracle.getBalancePrice(usdFake, wbtc);
    const mcPrice = await oracle.getMargincallPrice(usdFake, wbtc);

    printPrices(balancePrice, mcPrice, 8);

    const revBalancePrice = await oracle.getBalancePrice(wbtc, usdFake);
    const revMcPrice = await oracle.getMargincallPrice(wbtc, usdFake);

    printPrices(revBalancePrice, revMcPrice, -8);
  });
});
