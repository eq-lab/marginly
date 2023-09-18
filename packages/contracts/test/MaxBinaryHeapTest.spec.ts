import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { generateWallets } from './shared/utils';
import snapshotGasCost from '@uniswap/snapshot-gas-cost';

describe('MaxBinaryHeapTest', () => {
  async function deployMaxBinaryHeapTestFixture() {
    // Contracts are deployed using the first signer/account by default
    const signers = await ethers.getSigners();
    const [owner, otherAccount] = await ethers.getSigners();

    const factory = await ethers.getContractFactory('MaxBinaryHeapTest');
    const contract = await factory.deploy();
    await contract.deployed();

    return { contract, owner, otherAccount, signers };
  }

  it('should create empty heap', async () => {
    const { contract } = await loadFixture(deployMaxBinaryHeapTestFixture);

    expect((await contract.getHeapLength()).toNumber()).to.equal(0);
  });

  it('should return false when peek root on empty heap', async () => {
    const { contract } = await loadFixture(deployMaxBinaryHeapTestFixture);

    const [peekSuccess, _] = await contract.getNodeByIndex(0);
    expect(peekSuccess).to.be.false;
  });

  it('should return isEmpty', async () => {
    const { contract, otherAccount } = await loadFixture(deployMaxBinaryHeapTestFixture);

    expect(await contract.isEmpty()).to.be.true;
    await contract.connect(otherAccount).add(10, otherAccount.address);
    expect(await contract.isEmpty()).to.be.false;
  });

  it('should add new item and rebuild tree', async () => {
    const { contract, owner, otherAccount } = await loadFixture(deployMaxBinaryHeapTestFixture);
    const item = 125;

    await snapshotGasCost(contract.connect(otherAccount).add(item, otherAccount.address));
    expect(await contract.getHeapLength()).to.equal(1);

    const [peekSuccess, root] = await contract.getNodeByIndex(0);
    expect(peekSuccess).to.be.true;
    expect(root.key).to.equal(item);
    expect(root.account).to.equal(otherAccount.address);

    const position = await contract.positions(otherAccount.address);
    expect(position.heapPosition).to.be.equal(1);
  });

  it('should return success=false when trying to get index of not existed in the heap account', async () => {
    const { contract, owner, otherAccount } = await loadFixture(deployMaxBinaryHeapTestFixture);
    const item = 125;

    await contract.connect(otherAccount).add(item, otherAccount.address);
  });

  it('should return success=false on empty heap', async () => {
    const { contract } = await loadFixture(deployMaxBinaryHeapTestFixture);
    const [success, node] = await contract.getNodeByIndex(0);
    expect(success).to.be.false;
  });

  it('should remove root item and rebuild tree', async () => {
    const { contract, owner, otherAccount } = await loadFixture(deployMaxBinaryHeapTestFixture);
    await contract.connect(otherAccount).add(1, otherAccount.address);
    await contract.connect(owner).add(2, owner.address);

    expect(await contract.getHeapLength()).to.equal(2);

    const [, rootItem] = await contract.connect(otherAccount).getNodeByIndex(0);
    await contract.connect(otherAccount).remove(0);
    expect(rootItem.key).to.equal(2);

    const removedPosition = await contract.positions(rootItem.account);
    expect(removedPosition.heapPosition).to.be.equal(0);

    expect(await contract.getHeapLength()).to.equal(1);

    const [, lastItem] = await contract.connect(otherAccount).getNodeByIndex(0);

    const lastItemPosition = await contract.positions(lastItem.account);
    expect(lastItemPosition.heapPosition).to.be.equal(1);
  });

  it('should remove item by index', async () => {
    /**
     * Create tree
     *        10
     *       /  \
     *      6   4
     *    / \
     *   3  5
     */
    const { contract, signers } = await loadFixture(deployMaxBinaryHeapTestFixture);
    await contract.connect(signers[0]).add(4, signers[0].address);
    await contract.connect(signers[1]).add(3, signers[1].address);
    await contract.connect(signers[2]).add(5, signers[2].address);
    await contract.connect(signers[3]).add(6, signers[3].address);
    await contract.connect(signers[4]).add(10, signers[4].address);

    await snapshotGasCost(contract.remove(1));

    let success, topItem;
    [success, topItem] = await contract.getNodeByIndex(0);
    await (await contract.remove(0)).wait();
    let position = await contract.positions(topItem.account);
    expect(success).to.be.true;
    expect(topItem.key).to.be.equal(10);
    expect(topItem.account).to.be.equal(signers[4].address);
    expect(position.heapPosition).to.be.equal(0);

    [success, topItem] = await contract.getNodeByIndex(0);
    await (await contract.remove(0)).wait();
    position = await contract.positions(topItem.account);
    expect(success).to.be.true;
    expect(topItem.key).to.be.equal(5);
    expect(topItem.account).to.be.equal(signers[2].address);
    expect(position.heapPosition).to.be.equal(0);

    [success, topItem] = await contract.getNodeByIndex(0);
    await (await contract.remove(0)).wait();
    position = await contract.positions(topItem.account);
    expect(success).to.be.true;
    expect(topItem.key).to.be.equal(4);
    expect(topItem.account).to.be.equal(signers[0].address);
    expect(position.heapPosition).to.be.equal(0);

    [success, topItem] = await contract.getNodeByIndex(0);
    await (await contract.remove(0)).wait();
    position = await contract.positions(topItem.account);
    expect(success).to.be.true;
    expect(topItem.key).to.be.equal(3);
    expect(topItem.account).to.be.equal(signers[1].address);
    expect(position.heapPosition).to.be.equal(0);

    [success, topItem] = await contract.getNodeByIndex(0);
    expect(success).to.be.false;
  });

  it('should remove from last to top', async () => {
    /**
     * Create tree
     *        10
     *       /  \
     *      6   4
     *    / \
     *   3  5
     */
    const { contract, signers } = await loadFixture(deployMaxBinaryHeapTestFixture);
    await contract.connect(signers[0]).add(4, signers[0].address);
    await contract.connect(signers[1]).add(3, signers[1].address);
    await contract.connect(signers[2]).add(5, signers[2].address);
    await contract.connect(signers[3]).add(6, signers[3].address);
    await contract.connect(signers[4]).add(10, signers[4].address);

    for (let i = 4; i >= 0; i--) {
      const [success, last] = await contract.getNodeByIndex(i);
      let position = await contract.positions(last.account);
      expect(position.heapPosition).to.be.eq(i + 1);

      await contract.remove(i);

      position = await contract.positions(last.account);
      expect(position.heapPosition).to.be.eq(0);
    }
  });

  it('should remove arbitary element ', async () => {
    /**
     * Create tree
     *        10
     *       /  \
     *      6   4
     *    / \
     *   3  5
     */
    const { contract, signers } = await loadFixture(deployMaxBinaryHeapTestFixture);
    await contract.connect(signers[0]).add(4, signers[0].address);
    await contract.connect(signers[1]).add(3, signers[1].address);
    await contract.connect(signers[2]).add(5, signers[2].address);
    await contract.connect(signers[3]).add(6, signers[3].address);
    await contract.connect(signers[4]).add(10, signers[4].address);

    const toRemove = 1;
    const [success, last] = await contract.getNodeByIndex(toRemove);
    let position = await contract.positions(last.account);
    expect(position.heapPosition).to.be.eq(toRemove + 1);

    await contract.remove(1);

    position = await contract.positions(last.account);
    expect(position.heapPosition).to.be.eq(0);
  });

  it('should remove element and update tree', async () => {
    /**
     * Create tree
     *          1008
     *        /      \
     *      1003     1006
     *     /   \      /
     *   1002  1000  1005
     */
    const { contract, signers } = await loadFixture(deployMaxBinaryHeapTestFixture);
    await contract.connect(signers[0]).add(1008, signers[0].address);
    await contract.connect(signers[1]).add(1003, signers[1].address);
    await contract.connect(signers[2]).add(1006, signers[2].address);
    await contract.connect(signers[3]).add(1002, signers[3].address);
    await contract.connect(signers[4]).add(1000, signers[4].address);
    await contract.connect(signers[5]).add(1005, signers[5].address);

    //remove signer[4] node and
    const toRemove = 4;
    const [, node] = await contract.getNodeByIndex(toRemove);
    expect(node.account).to.be.eq(signers[4].address);
    expect(node.key).to.be.eq(1000);
    const position = await contract.positions(node.account);
    expect(position.heapPosition).to.be.eq(toRemove + 1);

    await contract.remove(toRemove);
    contract.updateByIndex(0, 1001);

    let prevKey = null;
    for (let i = 0; i < 5; i++) {
      const [, root] = await contract.getNodeByIndex(0);
      await contract.remove(0);

      if (prevKey) {
        expect(prevKey).to.be.greaterThanOrEqual(root.key);
      }

      prevKey = root.key;
    }
  });

  describe('Should update heap by index', () => {
    /**
     * Deploy contract and prepare heap
     *          50
     *        /    \
     *       40     30
     *      /  \
     *     20   10
     */
    async function prepareHeap() {
      const [owner, first, second, third, fourth] = await ethers.getSigners();

      const factory = await ethers.getContractFactory('MaxBinaryHeapTest');
      const contract = await factory.deploy();
      await contract.deployed();

      await contract.connect(owner).add(50, owner.address);
      await contract.connect(first).add(40, first.address);
      await contract.connect(second).add(30, second.address);
      await contract.connect(third).add(20, third.address);
      await contract.connect(fourth).add(10, fourth.address);

      expect(await contract.getHeapLength()).to.be.equal(5);

      {
        const [, node] = await contract.getNodeByIndex(0);
        const position = await contract.positions(node.account);
        expect(node.key).to.be.equal(50);
        expect(position.heapPosition).to.be.equal(1);
      }

      {
        const [, node] = await contract.getNodeByIndex(1);
        const position = await contract.positions(node.account);
        expect(node.key).to.be.equal(40);
        expect(position.heapPosition).to.be.equal(2);
      }

      {
        const [, node] = await contract.getNodeByIndex(2);
        const position = await contract.positions(node.account);
        expect(node.key).to.be.equal(30);
        expect(position.heapPosition).to.be.equal(3);
      }

      {
        const [, node] = await contract.getNodeByIndex(3);
        const position = await contract.positions(node.account);
        expect(node.key).to.be.equal(20);
        expect(position.heapPosition).to.be.equal(4);
      }

      {
        const [, node] = await contract.getNodeByIndex(4);
        const position = await contract.positions(node.account);
        expect(node.key).to.be.equal(10);
        expect(position.heapPosition).to.be.equal(5);
      }

      return { contract, owner, first, second, third, fourth };
    }

    it('without changing position', async () => {
      const { contract, owner } = await loadFixture(prepareHeap);
      await snapshotGasCost(contract.connect(owner).updateByIndex(0, 55));

      const [, rootNode] = await contract.getNodeByIndex(0);
      expect(rootNode.key.toNumber()).to.be.equal(55);
      expect(rootNode.account).to.be.equal(owner.address);
    });

    it('from middle to top', async () => {
      const { contract, owner, first } = await loadFixture(prepareHeap);
      await snapshotGasCost(contract.connect(owner).updateByIndex(1, 55));

      const [, rootNode] = await contract.getNodeByIndex(0);
      expect(rootNode.key.toNumber()).to.be.equal(55);
      expect(rootNode.account).to.be.equal(first.address);

      const [, firstNode] = await contract.getNodeByIndex(1);
      expect(firstNode.key.toNumber()).to.be.equal(50);
      expect(firstNode.account).to.be.equal(owner.address);
    });

    it('from middle to bottom', async () => {
      const { contract, first, third } = await loadFixture(prepareHeap);
      await snapshotGasCost(contract.connect(first).updateByIndex(1, 15));

      const [, middleNode] = await contract.getNodeByIndex(1);
      expect(middleNode.key.toNumber()).to.be.equal(20);
      expect(middleNode.account).to.be.equal(third.address);

      const [, bottomNode] = await contract.getNodeByIndex(3);
      expect(bottomNode.key.toNumber()).to.be.equal(15);
      expect(bottomNode.account).to.be.equal(first.address);
    });

    it('from top to bottom', async () => {
      const { contract, owner, first, third } = await loadFixture(prepareHeap);
      await snapshotGasCost(contract.connect(first).updateByIndex(0, 15));

      const [getTopNodeSuccess, topNode] = await contract.getNodeByIndex(0);
      expect(getTopNodeSuccess).to.be.true;
      expect(topNode.key.toNumber()).to.be.equal(40);
      expect(topNode.account).to.be.equal(first.address);

      const [getFirstNodeSuccess, firstNode] = await contract.getNodeByIndex(1);
      expect(getFirstNodeSuccess).to.be.true;
      expect(firstNode.key.toNumber()).to.be.equal(20);
      expect(firstNode.account).to.be.equal(third.address);

      const [getThirdNodeSuccess, thirdNode] = await contract.getNodeByIndex(3);
      expect(getThirdNodeSuccess).to.be.true;
      expect(thirdNode.key.toNumber()).to.be.equal(15);
      expect(thirdNode.account).to.be.equal(owner.address);
    });

    it('from bottom to top', async () => {
      const { contract, owner, first, third, fourth } = await loadFixture(prepareHeap);
      await snapshotGasCost(contract.connect(first).updateByIndex(4, 55));

      const [getTopNodeSuccess, topNode] = await contract.getNodeByIndex(0);
      expect(getTopNodeSuccess).to.be.true;
      expect(topNode.key.toNumber()).to.be.equal(55);
      expect(topNode.account).to.be.equal(fourth.address);

      const [getBottomNodeSuccess, bottomNode] = await contract.getNodeByIndex(4);
      expect(getBottomNodeSuccess).to.be.true;
      expect(bottomNode.key.toNumber()).to.be.equal(40);
      expect(bottomNode.account).to.be.equal(first.address);

      const [getFirstNodeSuccess, firstNode] = await contract.getNodeByIndex(1);
      expect(getFirstNodeSuccess).to.be.true;
      expect(firstNode.key.toNumber()).to.be.equal(50);
      expect(firstNode.account).to.be.equal(owner.address);
    });

    it('should update node account by index', async () => {
      const { contract, owner, first, third, fourth } = await loadFixture(prepareHeap);

      let [success, fourthNode] = await contract.getNodeByIndex(4);
      expect(fourthNode.account).to.be.equal(fourth.address);

      await snapshotGasCost(contract.connect(first).updateAccount(4, first.address));

      [success, fourthNode] = await contract.getNodeByIndex(4);
      expect(fourthNode.account).to.be.equal(first.address);
    });
  });

  it('should create max binary heap and remove items in right order', async () => {
    const { contract, otherAccount } = await loadFixture(deployMaxBinaryHeapTestFixture);
    const wallets = await generateWallets(100);
    const heapLength = 100;

    expect(await contract.getHeapLength()).to.equal(0);

    for (let i = 0; i < heapLength; i++) {
      const value = i + 1;

      if (i == heapLength - 1) {
        //measure only last call
        await snapshotGasCost(contract.connect(otherAccount).add(value, wallets[i].address));
      } else {
        await contract.connect(otherAccount).add(value, wallets[i].address);
      }
    }

    expect(await contract.getHeapLength()).to.equal(heapLength);

    let prevKey;
    for (let i = 0; i < heapLength; i++) {
      const [_, topItem] = await contract.getNodeByIndex(0);
      const itemKey = topItem.key.toNumber();

      if (i == 0) {
        //measure only first call
        await snapshotGasCost(contract.connect(otherAccount).remove(0));
      } else {
        await contract.connect(otherAccount).remove(0);
      }

      // skip the very first check to ensure all next elements strict greater than prev
      if (i > 0) {
        expect(prevKey).to.be.greaterThan(itemKey);
      }
      prevKey = itemKey;
    }

    expect(await contract.getHeapLength()).to.equal(0);
  });
});
