import { ethers } from 'hardhat';
import { AlgebraTickOracle, AlgebraTickOracleDouble } from '../../../typechain-types/contracts/oracles';
import { getDecimalsDiff, printPrices } from '../../shared/common';

describe('Camelot oracle (AlgebraTickOracle)', () => {
  let oracle: AlgebraTickOracle;
  before(async () => {
    const camelotFactory = '0x1a3c9B1d2F0529D97f2afC5136Cc23e58f1FD35B';
    const factory = await ethers.getContractFactory('AlgebraTickOracle');
    oracle = await factory.deploy(camelotFactory);
  });

  it('grail-weth', async () => {
    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const grail = '0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8';

    await oracle.setOptions(weth, grail, 1800, 5);

    const balancePrice = await oracle.getBalancePrice(weth, grail);
    const mcPrice = await oracle.getMargincallPrice(weth, grail);

    const decimalsDiff = await getDecimalsDiff(weth, grail);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });

  it('wbtc-weth', async () => {
    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const wbtc = '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';

    await oracle.setOptions(weth, wbtc, 1800, 5);

    const balancePrice = await oracle.getBalancePrice(weth, wbtc);
    const mcPrice = await oracle.getMargincallPrice(weth, wbtc);

    const decimalsDiff = await getDecimalsDiff(weth, wbtc);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });

  it('gmx-weth', async () => {
    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const gmx = '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a';

    await oracle.setOptions(weth, gmx, 1800, 5);

    const balancePrice = await oracle.getBalancePrice(weth, gmx);
    const mcPrice = await oracle.getMargincallPrice(weth, gmx);

    const decimalsDiff = await getDecimalsDiff(weth, gmx);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });
});

describe('ZyberSwap oracle', () => {
  let oracle: AlgebraTickOracle;
  before(async () => {
    const zyberFactory = '0x9C2ABD632771b433E5E7507BcaA41cA3b25D8544';
    const factory = await ethers.getContractFactory('AlgebraTickOracle');
    oracle = await factory.deploy(zyberFactory);
  });

  it('wbtc-usdc.e', async () => {
    const usdcBridged = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8';
    const wbtc = '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';

    await oracle.setOptions(usdcBridged, wbtc, 1800, 5);

    const balancePrice = await oracle.getBalancePrice(usdcBridged, wbtc);
    const mcPrice = await oracle.getMargincallPrice(usdcBridged, wbtc);

    const decimalsDiff = await getDecimalsDiff(usdcBridged, wbtc);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });
});

describe('Camelot oracle (AlgebraTickOracleDouble)', () => {
  let oracle: AlgebraTickOracleDouble;
  beforeEach(async () => {
    const camelotFactory = '0x1a3c9B1d2F0529D97f2afC5136Cc23e58f1FD35B';
    const factory = await ethers.getContractFactory('AlgebraTickOracleDouble');
    oracle = await factory.deploy(camelotFactory);
  });

  it('grail-weth-usdt', async () => {
    const grail = '0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8';
    const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const usdt = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';

    await oracle.setOptions(usdt, grail, 1800, 5, weth);

    const balancePrice = await oracle.getBalancePrice(usdt, grail);
    const mcPrice = await oracle.getMargincallPrice(usdt, grail);

    const decimalsDiff = await getDecimalsDiff(usdt, grail);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });

  it('grail-usdc.e-usdt', async () => {
    const grail = '0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8';
    const usdcBridged = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8';
    const usdt = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';

    await oracle.setOptions(usdt, grail, 1800, 5, usdcBridged);

    const balancePrice = await oracle.getBalancePrice(usdt, grail);
    const mcPrice = await oracle.getMargincallPrice(usdt, grail);

    const decimalsDiff = await getDecimalsDiff(usdt, grail);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });
});
