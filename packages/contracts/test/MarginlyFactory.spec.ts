import { expect } from 'chai';
import { loadFixture, snapshotGasCost } from './shared/mocks';
import { MarginlyParamsStruct } from '../typechain-types/contracts/MarginlyFactory';
import { createMarginlyFactory } from './shared/fixtures';

describe('MarginlyFactory', () => {
  function getPoolParams() {
    const params: MarginlyParamsStruct = {
      interestRate: 54000, //5,4 %
      maxLeverage: 20,
      swapFee: 1000, // 0.1%
      positionSlippage: 20000, // 2%
      mcSlippage: 50000, //5%
      priceSecondsAgo: 900, // 15 min
      positionMinAmount: 1, // 1 WEI
      baseLimit: 1_000_000_000_000,
      quoteLimit: 1_000_000_000_000,
    };

    return { fee: 3000n, params };
  }

  it('should create pool', async () => {
    const { factory, uniswapPoolInfo } = await loadFixture(createMarginlyFactory);
    const quoteToken = uniswapPoolInfo.token0.address;
    const baseToken = uniswapPoolInfo.token1.address;
    const { fee, params } = getPoolParams();

    const pool = await factory.callStatic.createPool(quoteToken, baseToken, fee, params);
    const tx = await factory.createPool(quoteToken, baseToken, fee, params);
    await snapshotGasCost(tx);
    await tx.wait();

    expect(await factory.getPool(quoteToken, baseToken, fee)).to.be.equal(pool);
    expect(await factory.getPool(baseToken, quoteToken, fee)).to.be.equal(pool);
  });

  it('should raise error when pool exists', async () => {
    const { factory, uniswapPoolInfo } = await loadFixture(createMarginlyFactory);
    const quoteToken = uniswapPoolInfo.token0.address;
    const baseToken = uniswapPoolInfo.token1.address;
    const { fee, params } = getPoolParams();

    await (await factory.createPool(quoteToken, baseToken, fee, params)).wait();
    expect(factory.createPool(quoteToken, baseToken, fee, params)).to.be.revertedWith('Pool already created');
  });

  it('should raise error when Uniswap pool not found for pair', async () => {
    const { factory, uniswapPoolInfo } = await loadFixture(createMarginlyFactory);

    const quoteToken = uniswapPoolInfo.token1.address;
    const baseToken = uniswapPoolInfo.token1.address;
    const { fee, params } = getPoolParams();

    expect(factory.createPool(quoteToken, baseToken, fee, params)).to.be.revertedWith('Uniswap pool not found');
  });

  it('should raise error when trying to create pool with the same tokens', async () => {
    const { factory, uniswapPoolInfo } = await loadFixture(createMarginlyFactory);
    const quoteToken = uniswapPoolInfo.token0.address;
    const { fee, params } = getPoolParams();

    expect(factory.createPool(quoteToken, quoteToken, fee, params)).to.be.revertedWithoutReason();
  });
});
