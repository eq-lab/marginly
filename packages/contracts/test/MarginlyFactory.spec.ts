import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { MarginlyParamsStruct } from '../typechain-types/contracts/MarginlyFactory';
import { createMarginlyFactory } from './shared/fixtures';
import snapshotGasCost from '@uniswap/snapshot-gas-cost';
import { MarginlyPool } from '../typechain-types';
import { ethers } from 'hardhat';
import { PositionType } from './shared/utils';

describe('MarginlyFactory', () => {
  function getPoolParams() {
    const params: MarginlyParamsStruct = {
      interestRate: 54000, //5,4 %
      fee: 10000, //1%
      maxLeverage: 20,
      swapFee: 1000, // 0.1%
      mcSlippage: 50000, //5%
      priceSecondsAgo: 900, // 15 min
      priceSecondsAgoMC: 60, // 1 min
      positionMinAmount: 1, // 1 WEI
      quoteLimit: 1_000_000_000_000,
    };

    return { fee: 3000n, params };
  }

  it('should create pool', async () => {
    const { factory, uniswapPoolInfo } = await loadFixture(createMarginlyFactory);
    const quoteToken = uniswapPoolInfo.token0.address;
    const baseToken = uniswapPoolInfo.token1.address;
    const { fee, params } = getPoolParams();

    const poolAddress = await factory.callStatic.createPool(quoteToken, baseToken, fee, params);
    await snapshotGasCost(factory.createPool(quoteToken, baseToken, fee, params));

    expect(await factory.getPool(quoteToken, baseToken, fee)).to.be.equal(poolAddress);
    expect(await factory.getPool(baseToken, quoteToken, fee)).to.be.equal(poolAddress);

    const poolFactory = await ethers.getContractFactory('MarginlyPool');
    const pool = poolFactory.attach(poolAddress) as MarginlyPool;

    const techPositionOwner = await factory.techPositionOwner();
    const techPosition = await pool.positions(techPositionOwner);
    expect(techPosition._type).to.be.eq(PositionType.Lend);
  });

  it('should change router address', async () => {
    const { factory } = await loadFixture(createMarginlyFactory);
    const routerAddress = await factory.swapRouter();
    const newAddress = factory.address;

    await factory.changeSwapRouter(newAddress);

    const currentRouterAddress = await factory.swapRouter();
    expect(currentRouterAddress).to.be.not.eq(routerAddress);
    expect(currentRouterAddress).to.be.eq(newAddress);
  });

  it('should raise error when pool exists', async () => {
    const { factory, uniswapPoolInfo } = await loadFixture(createMarginlyFactory);
    const quoteToken = uniswapPoolInfo.token0.address;
    const baseToken = uniswapPoolInfo.token1.address;
    const { fee, params } = getPoolParams();

    await factory.createPool(quoteToken, baseToken, fee, params);
    await expect(factory.createPool(quoteToken, baseToken, fee, params)).to.be.revertedWithCustomError(
      factory,
      'PoolAlreadyCreated'
    );
  });

  it('should raise error when Uniswap pool not found for pair', async () => {
    const { factory, uniswapPoolInfo } = await loadFixture(createMarginlyFactory);

    const quoteToken = uniswapPoolInfo.token1.address;
    const randomAddress = factory.address;
    const { fee, params } = getPoolParams();

    await expect(factory.createPool(quoteToken, randomAddress, fee, params)).to.be.revertedWithCustomError(
      factory,
      'UniswapPoolNotFound'
    );
  });

  it('should raise error when trying to create pool with the same tokens', async () => {
    const { factory, uniswapPoolInfo } = await loadFixture(createMarginlyFactory);
    const quoteToken = uniswapPoolInfo.token0.address;
    const { fee, params } = getPoolParams();

    await expect(factory.createPool(quoteToken, quoteToken, fee, params)).to.be.revertedWithCustomError(
      factory,
      'Forbidden'
    );
  });
});
