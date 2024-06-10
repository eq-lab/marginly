import { TokenInfo } from '../../shared/fixtures';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';

describe('Pendle PT-ezETH-27JUN2024 / ezETH oracle before maturity (PendleOracle)', () => {
  async function initializeOraclePtezETH() {
    const pt = <TokenInfo>{
      address: '0x8EA5040d423410f1fdc363379Af88e1DB5eA1C34',
      symbol: 'PT-ezETH-27JUN2024',
      decimals: 18,
    };

    const ib = <TokenInfo>{
      address: '0x2416092f143378750bb29b79eD961ab195CcEea5',
      symbol: 'ezETH',
      decimals: 18,
    };

    const secondsAgo = 1000;
    const secondsAgoLiquidation = 100;
    const pendleMarket = '0x5E03C94Fc5Fb2E21882000A96Df0b63d2c4312e2';
    const pendlePtLpOracle = '0x1Fd95db7B7C0067De8D45C0cb35D59796adfD187';

    const oracle = await (await ethers.getContractFactory('PendleMarketOracle')).deploy(pendlePtLpOracle);
    await oracle.setPair(ib.address, pt.address, pendleMarket, secondsAgo, secondsAgoLiquidation);

    return {
      oracle,
      pt,
      ib,
      secondsAgo,
      secondsAgoLiquidation,
      pendleMarket: await ethers.getContractAt('PendleMarketV3', pendleMarket),
      pendlePtLpOracle: await ethers.getContractAt('PendlePtLpOracle', pendlePtLpOracle),
    };
  }

  it('PT-ezETH-27JUN2024 / ezETH', async () => {
    const { oracle, pt, ib } = await loadFixture(initializeOraclePtezETH);
    const balancePrice = await oracle.getBalancePrice(ib.address, pt.address);
    const margincallPrice = await oracle.getMargincallPrice(ib.address, pt.address);

    console.log(`balancePrice: ${balancePrice}`);
    console.log(`margincallPrice: ${margincallPrice}`);

    const balancePriceInverted = await oracle.getBalancePrice(pt.address, ib.address);
    const margincallPriceInverted = await oracle.getMargincallPrice(pt.address, ib.address);

    console.log(`balancePriceInverted: ${balancePriceInverted}`);
    console.log(`margincallPriceInverted: ${margincallPriceInverted}`);
  });
});
