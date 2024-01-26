import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { createMarginlyManager } from './shared/fixtures';
import { IAction } from '../typechain-types';
import { parseUnits } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';

describe('MarginlyManager', () => {
  it('create MarginlyManager', async () => {
    const [signer] = await ethers.getSigners();
    const nonZeroAddress = signer.address;
    await (await ethers.getContractFactory('MarginlyManager')).deploy(nonZeroAddress);
  });

  it('create MarginlyManager should be failed when zero address passed', async () => {
    const factory = await ethers.getContractFactory('MarginlyManager');
    await expect(factory.deploy(ethers.constants.AddressZero)).to.be.revertedWithCustomError(factory, 'ZeroAddress');
  });

  it('subscribe to action', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer] = await ethers.getSigners();

    const subOptions = {
      isOneTime: true,
      callData: '0x0102030405060708',
    };

    let storedSubOptions = await marginlyManager.subscriptions(
      signer.address,
      marginlyPool.address,
      testAction.address
    );
    expect(storedSubOptions.isOneTime).to.be.eq(false);
    expect(storedSubOptions.callData).to.be.eq('0x');

    const tx = await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);
    const txReceipt = await tx.wait();
    const subscribedEvent = txReceipt.events?.filter((x) => x.event === 'Subscribed')[0];

    expect(subscribedEvent?.args?.at(0)).to.be.eq(signer.address);
    expect(subscribedEvent?.args?.at(1).toLowerCase()).to.be.eq(marginlyPool.address.toLowerCase());
    expect(subscribedEvent?.args?.at(2)).to.be.eq(testAction.address);
    expect(subscribedEvent?.args?.at(3)).to.be.eq(subOptions.isOneTime);
    expect(subscribedEvent?.args?.at(4)).to.be.eq(subOptions.callData);

    storedSubOptions = await marginlyManager.subscriptions(signer.address, marginlyPool.address, testAction.address);
    expect(storedSubOptions.isOneTime).to.be.eq(subOptions.isOneTime);
    expect(storedSubOptions.callData).to.be.eq(subOptions.callData);
  });

  it('subscribe should fail when wrong address passed', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer] = await ethers.getSigners();

    const subOptions = {
      isOneTime: true,
      callData: '0x0102030405060708',
    };

    await expect(
      marginlyManager.connect(signer).subscribe(ethers.constants.AddressZero, testAction.address, subOptions)
    ).to.be.revertedWithCustomError(marginlyManager, 'UnknownMarginlyPool');

    await expect(
      marginlyManager.connect(signer).subscribe(marginlyPool.address, ethers.constants.AddressZero, subOptions)
    ).to.be.revertedWithCustomError(marginlyManager, 'ZeroAddress');
  });

  it('unsubscribe from action', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer] = await ethers.getSigners();

    const subOptions = {
      isOneTime: false,
      callData: '0x',
    };

    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    let storedSubOptions = await marginlyManager.subscriptions(
      signer.address,
      marginlyPool.address,
      testAction.address
    );
    expect(storedSubOptions.isOneTime).to.be.eq(subOptions.isOneTime);
    expect(storedSubOptions.callData).to.be.eq(subOptions.callData);

    const unsubOpts = {
      isOneTime: true,
      callData: '0x',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, unsubOpts);

    storedSubOptions = await marginlyManager.subscriptions(signer.address, marginlyPool.address, testAction.address);
    expect(storedSubOptions.isOneTime).to.be.eq(unsubOpts.isOneTime);
    expect(storedSubOptions.callData).to.be.eq(unsubOpts.callData);
  });

  it('should execute action', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer, keeper] = await ethers.getSigners();

    const subOptions = {
      isOneTime: false,
      callData: '0x01',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    const actionCallData: IAction.ActionArgsStruct = {
      position: signer.address,
      marginlyPool: marginlyPool.address,
      callData: ethers.utils.defaultAbiCoder.encode(['bool'], [false]),
    };

    await marginlyManager.connect(keeper).execute(testAction.address, actionCallData);

    const storedSubOptions = await marginlyManager.subscriptions(
      signer.address,
      marginlyPool.address,
      testAction.address
    );
    expect(storedSubOptions.isOneTime).to.be.eq(subOptions.isOneTime);
    expect(storedSubOptions.callData).to.be.eq(subOptions.callData);
  });

  it('should fail when action failed', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer, keeper] = await ethers.getSigners();

    const subOptions = {
      isOneTime: false,
      callData: '0x01',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    const actionCallData: IAction.ActionArgsStruct = {
      position: signer.address,
      marginlyPool: marginlyPool.address,
      callData: ethers.utils.defaultAbiCoder.encode(['bool'], [true]),
    };

    await expect(
      marginlyManager.connect(keeper).execute(testAction.address, actionCallData)
    ).to.be.revertedWithCustomError(marginlyManager, 'ActionFailed');
  });

  it('keeper should earn fee when action executed', async () => {
    const { marginlyManager, testAction, marginlyPool, quoteToken } = await loadFixture(createMarginlyManager);
    const [signer, keeper] = await ethers.getSigners();

    const subOptions = {
      isOneTime: false,
      callData: '0x01',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    const feeAmount: BigNumber = parseUnits('0.234', 18); // 1 token;
    quoteToken.mint(marginlyManager.address, feeAmount);

    const actionCallData: IAction.ActionArgsStruct = {
      position: signer.address,
      marginlyPool: marginlyPool.address,
      callData: ethers.utils.defaultAbiCoder.encode(['bool'], [false]),
    };

    const keeperBalanceBefore: BigNumber = await quoteToken.balanceOf(keeper.address);
    await marginlyManager.connect(keeper).execute(testAction.address, actionCallData);

    const keeperBalanceAfter: BigNumber = await quoteToken.balanceOf(keeper.address);
    expect(keeperBalanceBefore.add(feeAmount)).to.be.eq(keeperBalanceAfter);
  });

  it('oneTime action should be deleted after successful execution', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer, keeper] = await ethers.getSigners();

    const subOptions = {
      isOneTime: true,
      callData: '0x01',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    const actionCallData: IAction.ActionArgsStruct = {
      position: signer.address,
      marginlyPool: marginlyPool.address,
      callData: ethers.utils.defaultAbiCoder.encode(['bool'], [false]),
    };

    await marginlyManager.connect(keeper).execute(testAction.address, actionCallData);

    const storedSubOptions = await marginlyManager.subscriptions(
      signer.address,
      marginlyPool.address,
      testAction.address
    );
    expect(storedSubOptions.isOneTime).to.be.eq(false);
    expect(storedSubOptions.callData).to.be.eq('0x');
  });
});
