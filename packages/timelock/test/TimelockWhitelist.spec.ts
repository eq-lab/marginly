import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import {
  TimelockWhitelist,
  TimelockWhitelist__factory,
  MockMarginlyFactory__factory,
  MockMarginlyFactory,
  MockMarginlyPool__factory,
  MockMarginlyPool,
} from '../typechain-types';
import { MarginlyParamsStruct } from '../typechain-types/contracts/test/MockMarginlyFactory.sol/MockMarginlyPool';

describe('TimelockWhitelist', function () {
  async function deployTimelock() {
    const [signer, proposer1, proposer2, executor1, executor2] = await hre.ethers.getSigners();
    const proposers = [signer, proposer1, proposer2];
    const executors = [signer, executor1, executor2];
    const admin = ethers.ZeroAddress;
    const minDelay = 259_200; // 3 days

    const timelock = (await new TimelockWhitelist__factory(signer).deploy(
      minDelay,
      proposers,
      executors,
      admin,
      [],
      []
    )) as any as TimelockWhitelist;

    const factory = (await new MockMarginlyFactory__factory(signer).deploy(timelock)) as any as MockMarginlyFactory;
    const pool = (await new MockMarginlyPool__factory(signer).deploy(factory)) as any as MockMarginlyPool;

    return { timelock, proposers, executors, minDelay, factory, pool };
  }

  async function deployTimelockWithWhitelist() {
    const [signer, proposer1, proposer2, executor1, executor2] = await hre.ethers.getSigners();
    const proposers = [signer, proposer1, proposer2];
    const executors = [signer, executor1, executor2];
    const admin = ethers.ZeroAddress;
    const minDelay = 259_200; // 3 days

    const factory = (await new MockMarginlyFactory__factory(signer).deploy(signer)) as any as MockMarginlyFactory;
    const pool = (await new MockMarginlyPool__factory(signer).deploy(factory)) as any as MockMarginlyPool;

    const createPoolSignature = factory.createPool.fragment.selector;
    const setParametersSignature = pool.setParameters.fragment.selector;
    const sweepSignature = pool.sweepETH.fragment.selector;
    const shutdownSignature = pool.shutDown.fragment.selector;

    const factoryAddress = await factory.getAddress();
    const poolAddress = await pool.getAddress();

    const whitelistedTargets = [factoryAddress, poolAddress, poolAddress, poolAddress];
    const whitelistedMethods = [createPoolSignature, setParametersSignature, sweepSignature, shutdownSignature];

    const timelock = (await new TimelockWhitelist__factory(signer).deploy(
      minDelay,
      proposers,
      executors,
      admin,
      whitelistedTargets,
      whitelistedMethods
    )) as any as TimelockWhitelist;

    await factory.connect(signer).transferOwnership(timelock);

    const acceptOwnershipCallData = factory.interface.encodeFunctionData('acceptOwnership');
    await timelock
      .connect(signer)
      .schedule(factory, 0n, acceptOwnershipCallData, ethers.ZeroHash, ethers.ZeroHash, minDelay);

    await time.increase(minDelay);
    await timelock.connect(signer).execute(factory, 0n, acceptOwnershipCallData, ethers.ZeroHash, ethers.ZeroHash);

    expect(await factory.owner()).to.equal(timelock);

    return { timelock, proposers, executors, minDelay, factory, pool, whitelistedTargets, whitelistedMethods };
  }

  describe('Deployment', function () {
    it('Should set the right proposers', async () => {
      const { timelock, proposers } = await loadFixture(deployTimelock);
      const proposerRole = await timelock.PROPOSER_ROLE();

      for (const proposer of proposers) {
        expect(await timelock.hasRole(proposerRole, proposer)).to.equal(true);
      }
    });

    it('Should set the right executors', async () => {
      const { timelock, executors } = await loadFixture(deployTimelock);
      const executorRole = await timelock.EXECUTOR_ROLE();

      for (const executor of executors) {
        expect(await timelock.hasRole(executorRole, executor)).to.equal(true);
      }
    });

    it('Should set the right minDelay', async () => {
      const { timelock, minDelay } = await loadFixture(deployTimelock);
      expect(await timelock.getMinDelay()).to.equal(minDelay);
    });

    it('Should set predefined whitelisted targets and methods', async () => {
      const { timelock, minDelay, whitelistedMethods, whitelistedTargets } =
        await loadFixture(deployTimelockWithWhitelist);

      for (let i = 0; i < whitelistedMethods.length; i++) {
        expect(await timelock.isWhitelisted(whitelistedTargets[i], whitelistedMethods[i])).to.equal(true);
      }
    });
  });

  describe('Whitelist', () => {
    it('Should whitelist address and method', async () => {
      const { timelock, proposers, executors, factory, pool } = await loadFixture(deployTimelock);

      const createPoolSignature = factory.createPool.fragment.selector;
      const setParametersSignature = pool.setParameters.fragment.selector;
      const sweepSignature = pool.sweepETH.fragment.selector;
      const shutdownSignature = pool.shutDown.fragment.selector;

      const poolAddress = await pool.getAddress();
      const factoryAddress = await factory.getAddress();

      const timelockAddress = await timelock.getAddress();

      const targets = [];
      const values = [];
      const payloads = [];

      for (const [address, method] of [
        [factoryAddress, createPoolSignature],
        [poolAddress, setParametersSignature],
        [poolAddress, sweepSignature],
        [poolAddress, shutdownSignature],
      ]) {
        targets.push(timelockAddress);
        values.push(0n);
        payloads.push(timelock.interface.encodeFunctionData('whitelistMethods', [[address], [method], [true]]));

        expect(await timelock.isWhitelisted(address, method)).to.equal(false);
      }

      const minDelay = await timelock.getMinDelay();
      await timelock
        .connect(proposers[0])
        .scheduleBatch(targets, values, payloads, ethers.ZeroHash, ethers.ZeroHash, minDelay);

      await time.increase(minDelay); // 3 days

      await timelock.connect(executors[1]).executeBatch(targets, values, payloads, ethers.ZeroHash, ethers.ZeroHash);

      for (const [address, method] of [
        [factoryAddress, createPoolSignature],
        [poolAddress, setParametersSignature],
        [poolAddress, sweepSignature],
        [poolAddress, shutdownSignature],
      ]) {
        expect(await timelock.isWhitelisted(address, method)).to.equal(true);
      }
    });

    it('Should unwhitelist method', async () => {
      const { timelock, proposers, executors, factory, pool, whitelistedMethods, whitelistedTargets } =
        await loadFixture(deployTimelockWithWhitelist);

      const unwhitelistMethodCallData = timelock.interface.encodeFunctionData('whitelistMethods', [
        [whitelistedTargets[0]],
        [whitelistedMethods[0]],
        [false],
      ]);

      expect(await timelock.isWhitelisted(whitelistedTargets[0], whitelistedMethods[0])).to.equal(true);

      const minDelay = await timelock.getMinDelay();
      await timelock
        .connect(proposers[0])
        .schedule(timelock, 0n, unwhitelistMethodCallData, ethers.ZeroHash, ethers.ZeroHash, minDelay);

      await time.increase(minDelay); // 3 days

      await timelock
        .connect(executors[1])
        .execute(timelock, 0n, unwhitelistMethodCallData, ethers.ZeroHash, ethers.ZeroHash);

      expect(await timelock.isWhitelisted(whitelistedTargets[0], whitelistedMethods[0])).to.equal(false);
    });

    it('Should execute whitelisted method immediately', async () => {
      const { timelock, executors, pool } = await loadFixture(deployTimelockWithWhitelist);

      const setParametersCallData = pool.interface.encodeFunctionData('setParameters', [
        <MarginlyParamsStruct>{
          fee: 0n,
          interestRate: 0n,
          maxLeverage: 0n,
          mcSlippage: 0n,
          positionMinAmount: 0n,
          quoteLimit: 0n,
          swapFee: 0n,
          tickSecondsAgo: 0n,
          tickSecondsAgoMC: 0n,
        },
      ]);
      const method = setParametersCallData.slice(0, 10);
      expect(await timelock.isWhitelisted(pool, method)).to.equal(true);

      await expect(
        timelock.connect(executors[0]).execute(pool, 0n, setParametersCallData, ethers.ZeroHash, ethers.ZeroHash)
      )
        .to.emit(timelock, 'CallExecuted')
        .withArgs(ethers.ZeroHash, 0, pool, 0, setParametersCallData);
    });

    it('Could not execute not whitelisted method immediately', async () => {
      const { timelock, executors, factory } = await loadFixture(deployTimelockWithWhitelist);

      const changeSwapRouter = factory.interface.encodeFunctionData('changeSwapRouter', [ethers.ZeroAddress]);

      await expect(
        timelock.connect(executors[0]).execute(factory, 0n, changeSwapRouter, ethers.ZeroHash, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(timelock, 'TimelockUnexpectedOperationState');
    });

    it('Should execute not whitelisted method after min delay', async () => {
      const { timelock, proposers, executors, factory } = await loadFixture(deployTimelockWithWhitelist);

      const changeSwapRouterCallData = factory.interface.encodeFunctionData('changeSwapRouter', [ethers.ZeroAddress]);

      const minDelay = await timelock.getMinDelay();
      await timelock
        .connect(proposers[0])
        .schedule(factory, 0n, changeSwapRouterCallData, ethers.ZeroHash, ethers.ZeroHash, minDelay);

      await expect(
        timelock.connect(executors[2]).execute(factory, 0n, changeSwapRouterCallData, ethers.ZeroHash, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(timelock, 'TimelockUnexpectedOperationState');

      await time.increase(minDelay); // 3 days

      const operationId = await timelock.hashOperation(
        factory,
        0n,
        changeSwapRouterCallData,
        ethers.ZeroHash,
        ethers.ZeroHash
      );

      await expect(
        timelock.connect(executors[2]).execute(factory, 0n, changeSwapRouterCallData, ethers.ZeroHash, ethers.ZeroHash)
      )
        .to.emit(timelock, 'CallExecuted')
        .withArgs(operationId, 0, factory, 0, changeSwapRouterCallData);
    });
  });
});