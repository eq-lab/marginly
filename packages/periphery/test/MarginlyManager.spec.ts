import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { createMarginlyManager } from './shared/fixtures';
import { IAction, MarginlyManager } from '../typechain-types';
import { parseUnits } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';

type SubscriptionOpts = MarginlyManager.SubscriptionOptsStruct;
type ActionArgs = IAction.ActionArgsStruct;

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

    const subOptions: SubscriptionOpts = {
      isOneTime: true,
      encodedTriggerData: '0x0102030405060708',
    };

    let storedSubOptions = await marginlyManager.subscriptions(
      signer.address,
      marginlyPool.address,
      testAction.address
    );
    expect(storedSubOptions.isOneTime).to.be.eq(false);
    expect(storedSubOptions.encodedTriggerData).to.be.eq('0x');

    const tx = await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);
    const txReceipt = await tx.wait();
    const subscribedEvent = txReceipt.events?.filter((x) => x.event === 'Subscribed')[0];

    expect(subscribedEvent?.args?.at(0)).to.be.eq(signer.address);
    expect(subscribedEvent?.args?.at(1).toLowerCase()).to.be.eq(marginlyPool.address.toLowerCase());
    expect(subscribedEvent?.args?.at(2)).to.be.eq(testAction.address);
    expect(subscribedEvent?.args?.at(3)).to.be.eq(subOptions.isOneTime);
    expect(subscribedEvent?.args?.at(4)).to.be.eq(subOptions.encodedTriggerData);

    storedSubOptions = await marginlyManager.subscriptions(signer.address, marginlyPool.address, testAction.address);
    expect(storedSubOptions.isOneTime).to.be.eq(subOptions.isOneTime);
    expect(storedSubOptions.encodedTriggerData).to.be.eq(subOptions.encodedTriggerData);
  });

  it('subscribe should fail when wrong address passed', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer] = await ethers.getSigners();

    const subOptions: SubscriptionOpts = {
      isOneTime: true,
      encodedTriggerData: '0x0102030405060708',
    };

    await expect(
      marginlyManager.connect(signer).subscribe(ethers.constants.AddressZero, testAction.address, subOptions)
    ).to.be.revertedWithCustomError(marginlyManager, 'UnknownMarginlyPool');

    await expect(
      marginlyManager.connect(signer).subscribe(marginlyPool.address, ethers.constants.AddressZero, subOptions)
    ).to.be.revertedWithCustomError(marginlyManager, 'ActionNotAvailable');
  });

  it('unsubscribe from action', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer] = await ethers.getSigners();

    const subOptions: SubscriptionOpts = {
      isOneTime: false,
      encodedTriggerData: '0x',
    };

    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    let storedSubOptions = await marginlyManager.subscriptions(
      signer.address,
      marginlyPool.address,
      testAction.address
    );
    expect(storedSubOptions.isOneTime).to.be.eq(subOptions.isOneTime);
    expect(storedSubOptions.encodedTriggerData).to.be.eq(subOptions.encodedTriggerData);

    const unsubOpts: SubscriptionOpts = {
      isOneTime: true,
      encodedTriggerData: '0x',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, unsubOpts);

    storedSubOptions = await marginlyManager.subscriptions(signer.address, marginlyPool.address, testAction.address);
    expect(storedSubOptions.isOneTime).to.be.eq(unsubOpts.isOneTime);
    expect(storedSubOptions.encodedTriggerData).to.be.eq(unsubOpts.encodedTriggerData);
  });

  it('should execute action', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer, keeper] = await ethers.getSigners();

    const subOptions: SubscriptionOpts = {
      isOneTime: false,
      encodedTriggerData: '0x01',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    const actionCallData: ActionArgs = {
      position: signer.address,
      marginlyPool: marginlyPool.address,
      callData: ethers.utils.defaultAbiCoder.encode(['bool', 'bool'], [true, true]),
    };

    await marginlyManager.connect(keeper).execute(testAction.address, actionCallData);

    const storedSubOptions = await marginlyManager.subscriptions(
      signer.address,
      marginlyPool.address,
      testAction.address
    );
    expect(storedSubOptions.isOneTime).to.be.eq(subOptions.isOneTime);
    expect(storedSubOptions.encodedTriggerData).to.be.eq(subOptions.encodedTriggerData);
  });

  it('should fail execution when no subscription', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer, keeper] = await ethers.getSigners();

    const actionCallData: ActionArgs = {
      position: signer.address,
      marginlyPool: marginlyPool.address,
      callData: ethers.utils.defaultAbiCoder.encode(['bool', 'bool'], [true, true]),
    };

    await expect(
      marginlyManager.connect(keeper).execute(testAction.address, actionCallData)
    ).to.be.revertedWithCustomError(marginlyManager, 'NoSubscription');
  });

  it('should fail execution when action is not triggered', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer, keeper] = await ethers.getSigners();

    const subOptions: SubscriptionOpts = {
      isOneTime: false,
      encodedTriggerData: '0x01',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    const actionCallData: ActionArgs = {
      position: signer.address,
      marginlyPool: marginlyPool.address,
      callData: ethers.utils.defaultAbiCoder.encode(['bool', 'bool'], [true, false]),
    };

    await expect(
      marginlyManager.connect(keeper).execute(testAction.address, actionCallData)
    ).to.be.revertedWithCustomError(marginlyManager, 'ActionNotTriggered');
  });

  it('should fail when action failed', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer, keeper] = await ethers.getSigners();

    const subOptions: SubscriptionOpts = {
      isOneTime: false,
      encodedTriggerData: '0x01',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    const actionCallData: ActionArgs = {
      position: signer.address,
      marginlyPool: marginlyPool.address,
      callData: ethers.utils.defaultAbiCoder.encode(['bool', 'bool'], [false, true]),
    };

    await expect(
      marginlyManager.connect(keeper).execute(testAction.address, actionCallData)
    ).to.be.revertedWithCustomError(marginlyManager, 'ActionFailed');
  });

  it('keeper should earn fee when action executed', async () => {
    const { marginlyManager, testAction, marginlyPool, quoteToken } = await loadFixture(createMarginlyManager);
    const [signer, keeper] = await ethers.getSigners();

    const subOptions: SubscriptionOpts = {
      isOneTime: false,
      encodedTriggerData: '0x01',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    const feeAmount: BigNumber = parseUnits('0.234', 18); // 1 token;
    quoteToken.mint(marginlyManager.address, feeAmount);

    const actionCallData: ActionArgs = {
      position: signer.address,
      marginlyPool: marginlyPool.address,
      callData: ethers.utils.defaultAbiCoder.encode(['bool', 'bool'], [true, true]),
    };

    const keeperBalanceBefore: BigNumber = await quoteToken.balanceOf(keeper.address);
    await marginlyManager.connect(keeper).execute(testAction.address, actionCallData);

    const keeperBalanceAfter: BigNumber = await quoteToken.balanceOf(keeper.address);
    expect(keeperBalanceBefore.add(feeAmount)).to.be.eq(keeperBalanceAfter);
  });

  it('oneTime action should be deleted after successful execution', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [, signer, keeper] = await ethers.getSigners();

    const subOptions: SubscriptionOpts = {
      isOneTime: true,
      encodedTriggerData: '0x01',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    const actionCallData: ActionArgs = {
      position: signer.address,
      marginlyPool: marginlyPool.address,
      callData: ethers.utils.defaultAbiCoder.encode(['bool', 'bool'], [true, true]),
    };

    await marginlyManager.connect(keeper).execute(testAction.address, actionCallData);

    const storedSubOptions = await marginlyManager.subscriptions(
      signer.address,
      marginlyPool.address,
      testAction.address
    );
    expect(storedSubOptions.isOneTime).to.be.eq(false);
    expect(storedSubOptions.encodedTriggerData).to.be.eq('0x');
  });

  it('only owner could add or remove action', async () => {
    const { marginlyManager } = await loadFixture(createMarginlyManager);
    const [owner, signer] = await ethers.getSigners();

    const newActionAddress = '0xAB8434A8aB1586F3DA45eE0141731ca09eD0E533';

    await expect(marginlyManager.connect(signer).addAction(newActionAddress, true)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(marginlyManager.connect(signer).addAction(newActionAddress, false)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    let tx = await marginlyManager.connect(owner).addAction(newActionAddress, true);
    let txReceipt = await tx.wait();
    let actionAddedEvent = txReceipt.events?.filter((x) => x.event === 'ActionAdded')[0];

    expect(actionAddedEvent?.args?.at(0).toLowerCase()).to.be.eq(newActionAddress.toLocaleLowerCase());
    expect(actionAddedEvent?.args?.at(1)).to.be.eq(true);

    expect(await marginlyManager.actions(newActionAddress)).to.be.true;

    tx = await marginlyManager.connect(owner).addAction(newActionAddress, false);
    txReceipt = await tx.wait();
    actionAddedEvent = txReceipt.events?.filter((x) => x.event === 'ActionAdded')[0];

    expect(actionAddedEvent?.args?.at(0).toLowerCase()).to.be.eq(newActionAddress.toLocaleLowerCase());
    expect(actionAddedEvent?.args?.at(1)).to.be.eq(false);

    expect(await marginlyManager.actions(newActionAddress)).to.be.false;
  });

  it('should not execute deleted action', async () => {
    const { marginlyManager, testAction, marginlyPool } = await loadFixture(createMarginlyManager);
    const [owner, signer, keeper] = await ethers.getSigners();

    const subOptions: SubscriptionOpts = {
      isOneTime: false,
      encodedTriggerData: '0x01',
    };
    await marginlyManager.connect(signer).subscribe(marginlyPool.address, testAction.address, subOptions);

    const actionCallData: ActionArgs = {
      position: signer.address,
      marginlyPool: marginlyPool.address,
      callData: ethers.utils.defaultAbiCoder.encode(['bool', 'bool'], [true, true]),
    };

    await marginlyManager.connect(keeper).execute(testAction.address, actionCallData);

    await marginlyManager.connect(owner).addAction(testAction.address, false);

    await expect(
      marginlyManager.connect(keeper).execute(testAction.address, actionCallData)
    ).to.be.revertedWithCustomError(marginlyManager, 'ActionNotAvailable');
  });
});
