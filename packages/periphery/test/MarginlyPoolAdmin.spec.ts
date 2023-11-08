import { expect } from 'chai';
import { loadFixture, setBalance } from '@nomicfoundation/hardhat-network-helpers';
import { MarginlyParamsStruct } from '@marginly/contracts/typechain-types/contracts/MarginlyFactory';
import {
  attachAdapterStorage,
  attachMarginlyPool,
  createMarginlyPoolAdmin,
  createUniswapPool,
  UniswapV3DexIndex,
} from './shared/utils';
import { ethers } from 'hardhat';
import { PoolInputStruct, AdapterInputStruct } from '../typechain-types/contracts/MarginlyAdmin';

describe('MarginlyPoolAdmin', () => {
  function getPoolParams() {
    const params: MarginlyParamsStruct = {
      interestRate: 54000, //5,4 %
      fee: 10000, //1%
      maxLeverage: 20,
      swapFee: 1000, // 0.1%
      mcSlippage: 50000, //5%
      priceSecondsAgo: 900, // 15 min
      priceSecondsAgoMC: 900, // 15 min
      positionMinAmount: 1, // 1 WEI
      quoteLimit: 1_000_000_000_000,
    };

    return { fee: 3000n, params };
  }

  it('createPool', async () => {
    const { marginlyPoolAdmin, marginlyFactory, uniswapFactory } = await loadFixture(createMarginlyPoolAdmin);

    const { uniswapPool, token0, token1 } = await createUniswapPool();
    await uniswapFactory.addPool(uniswapPool.address);

    const { fee, params } = getPoolParams();
    await expect(marginlyFactory.createPool(token0.address, token1.address, fee, params)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    const [, signer1] = await ethers.getSigners();
    const marginlyPoolAddress = await marginlyPoolAdmin
      .connect(signer1)
      .callStatic.createPool(token0.address, token1.address, fee, params);
    await marginlyPoolAdmin.connect(signer1).createPool(token0.address, token1.address, fee, params);

    const poolOwner = await marginlyPoolAdmin.poolsOwners(marginlyPoolAddress);
    expect(poolOwner).to.be.equal(signer1.address);
  });

  it('setParameters', async () => {
    const { marginlyPoolAdmin, marginlyFactory, uniswapFactory } = await loadFixture(createMarginlyPoolAdmin);

    const { uniswapPool, token0, token1 } = await createUniswapPool();
    await uniswapFactory.addPool(uniswapPool.address);

    const { fee, params } = getPoolParams();
    await expect(marginlyFactory.createPool(token0.address, token1.address, fee, params)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    const [, signer1, signer2] = await ethers.getSigners();
    const marginlyPoolAddress = await marginlyPoolAdmin
      .connect(signer1)
      .callStatic.createPool(token0.address, token1.address, fee, params);
    await marginlyPoolAdmin.connect(signer1).createPool(token0.address, token1.address, fee, params);
    const marginlyPool = await attachMarginlyPool(marginlyPoolAddress);

    expect((await marginlyPool.params()).fee).to.be.equal(params.fee);
    params.fee = 50000; // 5%
    await expect(
      marginlyPoolAdmin.connect(signer2).setParameters(marginlyPoolAddress, params)
    ).to.be.revertedWithCustomError(marginlyPoolAdmin, 'NotOwner');
    await marginlyPoolAdmin.connect(signer1).setParameters(marginlyPoolAddress, params);
    expect((await marginlyPool.params()).fee).to.be.equal(params.fee);
  });

  it('shutDown', async () => {
    const { marginlyPoolAdmin, marginlyFactory, uniswapFactory } = await loadFixture(createMarginlyPoolAdmin);

    const { uniswapPool, token0, token1 } = await createUniswapPool();
    await uniswapFactory.addPool(uniswapPool.address);

    const { fee, params } = getPoolParams();
    await expect(marginlyFactory.createPool(token0.address, token1.address, fee, params)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    const [, signer1, signer2] = await ethers.getSigners();
    const marginlyPoolAddress = await marginlyPoolAdmin
      .connect(signer1)
      .callStatic.createPool(token0.address, token1.address, fee, params);
    await marginlyPoolAdmin.connect(signer1).createPool(token0.address, token1.address, fee, params);
    const marginlyPool = await attachMarginlyPool(marginlyPoolAddress);

    await expect(marginlyPoolAdmin.connect(signer2).shutDown(marginlyPoolAddress, 0)).to.be.revertedWithCustomError(
      marginlyPoolAdmin,
      'NotOwner'
    );
    await expect(marginlyPoolAdmin.connect(signer1).shutDown(marginlyPoolAddress, 0)).to.be.revertedWithCustomError(
      marginlyPool,
      'NotEmergency'
    );
  });

  it('sweepETH', async () => {
    const { marginlyPoolAdmin, marginlyFactory, uniswapFactory } = await loadFixture(createMarginlyPoolAdmin);

    const { uniswapPool, token0, token1 } = await createUniswapPool();
    await uniswapFactory.addPool(uniswapPool.address);

    const { fee, params } = getPoolParams();
    await expect(marginlyFactory.createPool(token0.address, token1.address, fee, params)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    const [, signer1, signer2] = await ethers.getSigners();
    const marginlyPoolAddress = await marginlyPoolAdmin
      .connect(signer1)
      .callStatic.createPool(token0.address, token1.address, fee, params);
    await marginlyPoolAdmin.connect(signer1).createPool(token0.address, token1.address, fee, params);

    const transferAmount = ethers.utils.parseEther('0.5');
    await setBalance(marginlyPoolAddress, transferAmount);

    const balanceBefore = await ethers.provider.getBalance(marginlyPoolAddress);
    expect(balanceBefore).to.be.equal(transferAmount);
    const signerBalanceBefore = await signer1.getBalance();

    await expect(marginlyPoolAdmin.connect(signer2).sweepETH(marginlyPoolAddress)).to.be.revertedWithCustomError(
      marginlyPoolAdmin,
      'NotOwner'
    );

    const amount = await marginlyPoolAdmin.connect(signer1).callStatic.sweepETH(marginlyPoolAddress);
    const tx = await marginlyPoolAdmin.connect(signer1).sweepETH(marginlyPoolAddress);
    const txReceipt = await tx.wait();
    const txFee = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);
    expect(amount).to.be.equal(transferAmount);

    const signerBalanceAfter = await signer1.getBalance();
    expect(signerBalanceAfter).to.be.equal(signerBalanceBefore.add(transferAmount).sub(txFee));
  });

  it('changeSwapRouter', async () => {
    const { marginlyPoolAdmin, uniswapFactory, marginlyFactory } = await loadFixture(createMarginlyPoolAdmin);

    const { uniswapPool } = await createUniswapPool();
    await uniswapFactory.addPool(uniswapPool.address);

    const [rootSigner, signer1] = await ethers.getSigners();
    
    const oldSwapRouter = await marginlyFactory.swapRouter();

    await expect(marginlyPoolAdmin.connect(signer1).changeSwapRouter(uniswapPool.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await marginlyPoolAdmin.connect(rootSigner).changeSwapRouter(uniswapPool.address);

    expect(await marginlyFactory.swapRouter()).to.be.equal(uniswapPool.address);
    expect(await marginlyFactory.swapRouter()).to.be.not.equal(oldSwapRouter);
  });

  it('addAdapter', async () => {
    const { marginlyPoolAdmin, uniswapFactory, marginlyRouter } = await loadFixture(createMarginlyPoolAdmin);

    const { uniswapPool } = await createUniswapPool();
    await uniswapFactory.addPool(uniswapPool.address);

    const [rootSigner, signer1] = await ethers.getSigners();

    const newDexIndex = 1;
    expect(await marginlyRouter.adapters(newDexIndex)).to.be.equal(ethers.constants.AddressZero);

    const adapterInput = <AdapterInputStruct>{
      dexIndex: newDexIndex,
      adapter: uniswapPool.address,
    };
    await expect(marginlyPoolAdmin.connect(signer1).addDexAdapters([adapterInput])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await marginlyPoolAdmin.connect(rootSigner).addDexAdapters([adapterInput]);

    expect(await marginlyRouter.adapters(newDexIndex)).to.be.equal(uniswapPool.address);
  });

  it('addPools', async () => {
    const { marginlyPoolAdmin, uniswapFactory, marginlyRouter } = await loadFixture(createMarginlyPoolAdmin);

    const { uniswapPool, token0, token1 } = await createUniswapPool();
    await uniswapFactory.addPool(uniswapPool.address);

    const [rootSigner, signer1] = await ethers.getSigners();

    const uniswapV3AdapterAddress = await marginlyRouter.adapters(UniswapV3DexIndex);
    const uniswapV3Adapter = await attachAdapterStorage(uniswapV3AdapterAddress);

    expect(await uniswapV3Adapter.getPool(token0.address, token1.address)).to.be.equal(ethers.constants.AddressZero);

    const poolInput = <PoolInputStruct>{
      token0: token0.address,
      token1: token1.address,
      pool: uniswapPool.address,
    };
    await expect(marginlyPoolAdmin.connect(signer1).addPools([poolInput])).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await marginlyPoolAdmin.connect(rootSigner).addPools([poolInput]);

    expect(await uniswapV3Adapter.getPool(token0.address, token1.address)).to.be.equal(uniswapPool.address);
  });

  it('transferOwnership', async () => {
    const { marginlyPoolAdmin } = await loadFixture(createMarginlyPoolAdmin);

    const [rootSigner, signer1, newOwner] = await ethers.getSigners();

    expect(await marginlyPoolAdmin.owner()).to.be.equal(rootSigner.address);

    await expect(marginlyPoolAdmin.connect(signer1).transferOwnership(newOwner.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await marginlyPoolAdmin.connect(rootSigner).transferOwnership(newOwner.address);
    await marginlyPoolAdmin.connect(newOwner).acceptOwnership();

    expect(await marginlyPoolAdmin.owner()).to.be.equal(newOwner.address);
  });

  it('transferMarginlyFactoryOwnership', async () => {
    const { marginlyPoolAdmin, marginlyFactory } = await loadFixture(createMarginlyPoolAdmin);

    const [rootSigner, signer1, newOwner] = await ethers.getSigners();

    expect(await marginlyFactory.owner()).to.be.equal(marginlyPoolAdmin.address);

    await expect(
      marginlyPoolAdmin.connect(signer1).transferMarginlyFactoryOwnership(newOwner.address)
    ).to.be.revertedWith('Ownable: caller is not the owner');

    await marginlyPoolAdmin.connect(rootSigner).transferMarginlyFactoryOwnership(newOwner.address);
    await marginlyFactory.connect(newOwner).acceptOwnership();

    expect(await marginlyFactory.owner()).to.be.equal(newOwner.address);
  });

  it('transferMarginlyPoolOwnership', async () => {
    const { marginlyPoolAdmin, marginlyFactory, uniswapFactory } = await loadFixture(createMarginlyPoolAdmin);

    const { uniswapPool, token0, token1 } = await createUniswapPool();
    await uniswapFactory.addPool(uniswapPool.address);

    const { fee, params } = getPoolParams();
    await expect(marginlyFactory.createPool(token0.address, token1.address, fee, params)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    const [, signer1, signer2] = await ethers.getSigners();
    const marginlyPoolAddress = await marginlyPoolAdmin
      .connect(signer1)
      .callStatic.createPool(token0.address, token1.address, fee, params);

    await marginlyPoolAdmin.connect(signer1).createPool(token0.address, token1.address, fee, params);
    expect(await marginlyPoolAdmin.poolsOwners(marginlyPoolAddress)).to.be.equal(signer1.address);

    await expect(
      marginlyPoolAdmin.connect(signer2).transferMarginlyPoolOwnership(marginlyPoolAddress, signer2.address)
    ).to.be.revertedWithCustomError(marginlyPoolAdmin, 'NotOwner');

    await marginlyPoolAdmin.connect(signer1).transferMarginlyPoolOwnership(marginlyPoolAddress, signer2.address);
    expect(await marginlyPoolAdmin.poolsOwners(marginlyPoolAddress)).to.be.equal(signer2.address);
  });

  it('transferMarginlyRouterOwnership', async () => {
    const { marginlyPoolAdmin, marginlyFactory, uniswapFactory, marginlyRouter } = await loadFixture(
      createMarginlyPoolAdmin
    );

    const { uniswapPool, token0, token1 } = await createUniswapPool();
    await uniswapFactory.addPool(uniswapPool.address);

    const { fee, params } = getPoolParams();
    await expect(marginlyFactory.createPool(token0.address, token1.address, fee, params)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    const [rootSigner, signer1, newOwner] = await ethers.getSigners();

    await marginlyPoolAdmin.connect(signer1).createPool(token0.address, token1.address, fee, params);
    expect(await marginlyRouter.owner()).to.be.equal(marginlyPoolAdmin.address);

    await expect(
      marginlyPoolAdmin.connect(signer1).transferMarginlyRouterOwnership(newOwner.address)
    ).to.be.revertedWith('Ownable: caller is not the owner');

    await marginlyPoolAdmin.connect(rootSigner).transferMarginlyRouterOwnership(newOwner.address);
    await marginlyRouter.connect(newOwner).acceptOwnership();
    expect(await marginlyRouter.owner()).to.be.equal(newOwner.address);
  });

  it('transferRouterAdapterOwnership', async () => {
    const { marginlyPoolAdmin, marginlyFactory, uniswapFactory, marginlyRouter } = await loadFixture(
      createMarginlyPoolAdmin
    );

    const { uniswapPool, token0, token1 } = await createUniswapPool();
    await uniswapFactory.addPool(uniswapPool.address);

    const { fee, params } = getPoolParams();
    await expect(marginlyFactory.createPool(token0.address, token1.address, fee, params)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    const [rootSigner, signer1, newOwner] = await ethers.getSigners();
    const routerAdapter = await attachAdapterStorage(await marginlyRouter.adapters(0));
    await marginlyPoolAdmin.connect(signer1).createPool(token0.address, token1.address, fee, params);
    expect(await routerAdapter.owner()).to.be.equal(marginlyPoolAdmin.address);

    await expect(
      marginlyPoolAdmin.connect(signer1).transferRouterAdapterOwnership(0, newOwner.address)
    ).to.be.revertedWith('Ownable: caller is not the owner');

    await marginlyPoolAdmin.connect(rootSigner).transferRouterAdapterOwnership(0, newOwner.address);
    await routerAdapter.connect(newOwner).acceptOwnership();
    expect(await routerAdapter.owner()).to.be.equal(newOwner.address);
  });
});
