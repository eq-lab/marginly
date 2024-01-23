import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { Pool, Tokens, ZERO_ADDRESS, createSwapPoolRegistry } from './shared/fixtures';

describe('SwapPoolRegistry', () => {
  it('should be reverted when wrong constructor parameters', async () => {
    const contractFactory = await ethers.getContractFactory('SwapPoolRegistry');
    const uniswapV3FactoryAddress = ZERO_ADDRESS;

    await expect(contractFactory.deploy(uniswapV3FactoryAddress, [])).to.be.revertedWithCustomError(
      contractFactory,
      'WrongParameters'
    );
  });

  it('should create swapPoolRegistry', async () => {
    const contractFactory = await ethers.getContractFactory('SwapPoolRegistry');
    const uniswapV3FactoryAddress = '0x0000000000000000000000000000000000000001';
    const [_, owner] = await ethers.getSigners();

    const swapPools: Pool[] = [
      {
        pool: '0xFbB5eC68BB09e115bC803E8442A7c540ac093261',
        tokenA: Tokens.USDC,
        tokenB: Tokens.WETH,
        fee: 300,
      },
      {
        pool: '0xA063a18F141779cDF0631921EcEfc22b8B341eF9',
        tokenA: Tokens.GMX,
        tokenB: Tokens.MATIC,
        fee: 500,
      },
    ];

    const swapPoolRegistry = await contractFactory.connect(owner).deploy(uniswapV3FactoryAddress, swapPools);
    expect(await swapPoolRegistry.uniswapFactory()).to.be.eq(uniswapV3FactoryAddress);
    expect(await swapPoolRegistry.owner()).to.be.eq(owner.address);
  });

  it('should be reverted when not an owner try to add swap pool', async () => {
    const { swapPoolRegistry } = await loadFixture(createSwapPoolRegistry);
    const [, signer] = await ethers.getSigners();

    const swapPool: Pool[] = [
      {
        pool: '0xFbB5eC68BB09e115bC803E8442A7c540ac093261',
        tokenA: Tokens.USDC,
        tokenB: Tokens.WETH,
        fee: 300,
      },
    ];

    await expect(swapPoolRegistry.connect(signer).addSwapPool(swapPool)).to.be.revertedWithCustomError(
      swapPoolRegistry,
      'Forbidden'
    );
  });

  it('should override original pool', async () => {
    const { canonicalFactory, swapPoolRegistry } = await loadFixture(createSwapPoolRegistry);
    const swapPool: Pool = {
      pool: '0x0000000000000000000000000000000000000001',
      tokenA: Tokens.USDC,
      tokenB: Tokens.WETH,
      fee: 300,
    };

    const existingPool = await canonicalFactory.getPool(swapPool.tokenA, swapPool.tokenB, swapPool.fee);
    expect(existingPool).not.to.be.eq(swapPool.pool).and.not.to.be.eq(ZERO_ADDRESS);
    expect(await swapPoolRegistry.getPool(swapPool.tokenA, swapPool.tokenB, swapPool.fee)).to.be.eq(existingPool);

    await swapPoolRegistry.addSwapPool([swapPool]);
    expect(await swapPoolRegistry.getPool(swapPool.tokenA, swapPool.tokenB, swapPool.fee)).to.be.eq(swapPool.pool);
    expect(await swapPoolRegistry.getPool(swapPool.tokenB, swapPool.tokenA, swapPool.fee)).to.be.eq(swapPool.pool);
  });

  it('should return swap pool', async () => {
    const { canonicalFactory, swapPoolRegistry } = await loadFixture(createSwapPoolRegistry);
    const overridePool: Pool = {
      pool: '0x0000000000000000000000000000000000000001',
      tokenA: Tokens.GMX,
      tokenB: Tokens.WETH,
      fee: 1000,
    };

    expect(await canonicalFactory.getPool(overridePool.tokenA, overridePool.tokenB, overridePool.fee)).to.be.eq(
      ZERO_ADDRESS
    );

    await swapPoolRegistry.addSwapPool([overridePool]);
    expect(await swapPoolRegistry.getPool(overridePool.tokenA, overridePool.tokenB, overridePool.fee)).to.be.eq(
      overridePool.pool
    );
    expect(await swapPoolRegistry.getPool(overridePool.tokenB, overridePool.tokenA, overridePool.fee)).to.be.eq(
      overridePool.pool
    );
  });

  it('should be reverted when not an owner trying to set new owner', async () => {
    const { swapPoolRegistry } = await loadFixture(createSwapPoolRegistry);
    const [, notAnOwner] = await ethers.getSigners();

    await expect(swapPoolRegistry.connect(notAnOwner).setOwner(notAnOwner.address)).to.be.revertedWithCustomError(
      swapPoolRegistry,
      'Forbidden'
    );
  });

  it('should set new owner', async () => {
    const { swapPoolRegistry } = await loadFixture(createSwapPoolRegistry);
    const [owner, newOwner] = await ethers.getSigners();

    await swapPoolRegistry.connect(owner).setOwner(newOwner.address);
    expect(await swapPoolRegistry.owner()).to.be.eq(newOwner.address);
  });

  it('should be reverted when trying to call enableFeeAmount', async () => {
    const { swapPoolRegistry } = await loadFixture(createSwapPoolRegistry);
    await expect(swapPoolRegistry.enableFeeAmount(0, 0)).to.be.revertedWithCustomError(swapPoolRegistry, 'Forbidden');
  });

  it('should be reverted when trying to call createPool', async () => {
    const { swapPoolRegistry } = await loadFixture(createSwapPoolRegistry);
    await expect(swapPoolRegistry.createPool(ZERO_ADDRESS, ZERO_ADDRESS, 0)).to.be.revertedWithCustomError(
      swapPoolRegistry,
      'Forbidden'
    );
  });

  it('should be reverted when trying to add swap pool with wrong parameters', async () => {
    const { swapPoolRegistry } = await loadFixture(createSwapPoolRegistry);
    const swapPool: Pool = {
      pool: '0x0000000000000000000000000000000000000001',
      tokenA: Tokens.GMX,
      tokenB: Tokens.WETH,
      fee: 1000,
    };

    await expect(
      swapPoolRegistry.addSwapPool([{ ...swapPool, tokenB: swapPool.tokenA }])
    ).to.be.revertedWithCustomError(swapPoolRegistry, 'WrongParameters');

    await expect(swapPoolRegistry.addSwapPool([{ ...swapPool, tokenA: ZERO_ADDRESS }])).to.be.revertedWithCustomError(
      swapPoolRegistry,
      'WrongParameters'
    );

    await expect(swapPoolRegistry.addSwapPool([{ ...swapPool, tokenB: ZERO_ADDRESS }])).to.be.revertedWithCustomError(
      swapPoolRegistry,
      'WrongParameters'
    );
  });
});
