import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { Pool, Tokens, ZERO_ADDRESS, createUniswapV3FactoryOverrides } from './fixtures';

describe('UniswapV3FactoryOverride', () => {
  it('should be reverted when wrong constructor parameters', async () => {
    const contractFactory = await ethers.getContractFactory('UniswapV3FactoryOverride');
    const uniswapV3FactoryAddress = ZERO_ADDRESS;

    await expect(contractFactory.deploy(uniswapV3FactoryAddress, [])).to.be.revertedWithCustomError(
      contractFactory,
      'WrongParameters'
    );
  });

  it('should create factory', async () => {
    const contractFactory = await ethers.getContractFactory('UniswapV3FactoryOverride');
    const uniswapV3FactoryAddress = '0x0000000000000000000000000000000000000001';
    const [_, owner] = await ethers.getSigners();

    const overrides: Pool[] = [
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

    const factory = await contractFactory.connect(owner).deploy(uniswapV3FactoryAddress, overrides);
    expect(await factory.uniswapFactory()).to.be.eq(uniswapV3FactoryAddress);
    expect(await factory.owner()).to.be.eq(owner.address);
  });

  it('should be reverted when not an owner try to add pool override', async () => {
    const { factoryOverride } = await loadFixture(createUniswapV3FactoryOverrides);
    const [, signer] = await ethers.getSigners();

    const poolOverrides: Pool[] = [
      {
        pool: '0xFbB5eC68BB09e115bC803E8442A7c540ac093261',
        tokenA: Tokens.USDC,
        tokenB: Tokens.WETH,
        fee: 300,
      },
    ];

    await expect(factoryOverride.connect(signer).addPoolOverrides(poolOverrides)).to.be.revertedWithCustomError(
      factoryOverride,
      'Forbidden'
    );
  });

  it('should override original pool', async () => {
    const { canonicalFactory, factoryOverride } = await loadFixture(createUniswapV3FactoryOverrides);
    const overridePool: Pool = {
      pool: '0x0000000000000000000000000000000000000001',
      tokenA: Tokens.USDC,
      tokenB: Tokens.WETH,
      fee: 300,
    };

    const existingPool = await canonicalFactory.getPool(overridePool.tokenA, overridePool.tokenB, overridePool.fee);
    expect(existingPool).not.to.be.eq(overridePool.pool).and.not.to.be.eq(ZERO_ADDRESS);
    expect(await factoryOverride.getPool(overridePool.tokenA, overridePool.tokenB, overridePool.fee)).to.be.eq(
      existingPool
    );

    await factoryOverride.addPoolOverrides([overridePool]);
    expect(await factoryOverride.getPool(overridePool.tokenA, overridePool.tokenB, overridePool.fee)).to.be.eq(
      overridePool.pool
    );
    expect(await factoryOverride.getPool(overridePool.tokenB, overridePool.tokenA, overridePool.fee)).to.be.eq(
      overridePool.pool
    );
  });

  it('should return overrided pool', async () => {
    const { canonicalFactory, factoryOverride } = await loadFixture(createUniswapV3FactoryOverrides);
    const overridePool: Pool = {
      pool: '0x0000000000000000000000000000000000000001',
      tokenA: Tokens.GMX,
      tokenB: Tokens.WETH,
      fee: 1000,
    };

    expect(await canonicalFactory.getPool(overridePool.tokenA, overridePool.tokenB, overridePool.fee)).to.be.eq(
      ZERO_ADDRESS
    );

    await factoryOverride.addPoolOverrides([overridePool]);
    expect(await factoryOverride.getPool(overridePool.tokenA, overridePool.tokenB, overridePool.fee)).to.be.eq(
      overridePool.pool
    );
    expect(await factoryOverride.getPool(overridePool.tokenB, overridePool.tokenA, overridePool.fee)).to.be.eq(
      overridePool.pool
    );
  });

  it('should be reverted when not an owner trying to set new owner', async () => {
    const { factoryOverride } = await loadFixture(createUniswapV3FactoryOverrides);
    const [, notAnOwner] = await ethers.getSigners();

    await expect(factoryOverride.connect(notAnOwner).setOwner(notAnOwner.address)).to.be.revertedWithCustomError(
      factoryOverride,
      'Forbidden'
    );
  });

  it('should set new owner', async () => {
    const { factoryOverride } = await loadFixture(createUniswapV3FactoryOverrides);
    const [owner, newOwner] = await ethers.getSigners();

    await factoryOverride.connect(owner).setOwner(newOwner.address);
    expect(await factoryOverride.owner()).to.be.eq(newOwner.address);
  });

  it('should be reverted when trying to call enableFeeAmount', async () => {
    const { factoryOverride } = await loadFixture(createUniswapV3FactoryOverrides);
    await expect(factoryOverride.enableFeeAmount(0, 0)).to.be.revertedWithCustomError(factoryOverride, 'Forbidden');
  });

  it('should be reverted when trying to call createPool', async () => {
    const { factoryOverride } = await loadFixture(createUniswapV3FactoryOverrides);
    await expect(factoryOverride.createPool(ZERO_ADDRESS, ZERO_ADDRESS, 0)).to.be.revertedWithCustomError(
      factoryOverride,
      'Forbidden'
    );
  });

  it('should be reverted when trying to override with wrong parameters', async () => {
    const { factoryOverride } = await loadFixture(createUniswapV3FactoryOverrides);
    const overridePool: Pool = {
      pool: '0x0000000000000000000000000000000000000001',
      tokenA: Tokens.GMX,
      tokenB: Tokens.WETH,
      fee: 1000,
    };

    await expect(
      factoryOverride.addPoolOverrides([{ ...overridePool, tokenB: overridePool.tokenA }])
    ).to.be.revertedWithCustomError(factoryOverride, 'WrongParameters');

    await expect(
      factoryOverride.addPoolOverrides([{ ...overridePool, tokenA: ZERO_ADDRESS }])
    ).to.be.revertedWithCustomError(factoryOverride, 'WrongParameters');

    await expect(
      factoryOverride.addPoolOverrides([{ ...overridePool, tokenB: ZERO_ADDRESS }])
    ).to.be.revertedWithCustomError(factoryOverride, 'WrongParameters');
  });
});
