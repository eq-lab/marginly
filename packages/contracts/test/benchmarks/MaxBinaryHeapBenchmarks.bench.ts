import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { generateWallets } from '../shared/utils';

describe('Gas Benchmark - MaxBinaryHeap', () => {
  const gasBenchmarks: { method: string; length: number; gasUsed: number }[] = [];

  async function deployMaxBinaryHeapTestFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const factory = await ethers.getContractFactory('MaxBinaryHeapTest');
    const contract = await factory.deploy();
    await contract.deployed();

    return { contract, owner, otherAccount };
  }

  async function prepareHeap() {
    const { contract, owner, otherAccount } = await deployMaxBinaryHeapTestFixture();
    const heapLength = 1024;
    const wallets = await generateWallets(heapLength);

    expect((await contract.getHeapLength()).toNumber()).to.equal(0);

    for (let i = 0; i < heapLength; i++) {
      const value = i + 1; // worst case
      await contract.connect(owner).add(value, wallets[i].address);
    }

    expect((await contract.getHeapLength()).toNumber()).to.equal(heapLength);

    return { contract, owner, otherAccount, heapLength, wallets };
  }

  after(() => {
    console.table(gasBenchmarks);
  });

  it('Should add new item into heap', async () => {
    const { contract, otherAccount } = await loadFixture(deployMaxBinaryHeapTestFixture);
    const heapLength = 1024;
    const wallets = await generateWallets(heapLength);

    expect((await contract.getHeapLength()).toNumber()).to.equal(0);

    let gasUsed = 0;

    for (let i = 0; i < heapLength; i++) {
      const value = i + 1; // worst case
      const addItemTx = await contract.connect(otherAccount).add(value, wallets[i].address);
      const receipt = await addItemTx.wait();
      const currentGasUsed = receipt.gasUsed.toNumber();

      if (currentGasUsed > gasUsed) {
        gasUsed = currentGasUsed;
        gasBenchmarks.push({
          method: 'insert',
          length: i + 1,
          gasUsed: gasUsed,
        });
      }
    }

    expect((await contract.getHeapLength()).toNumber()).to.equal(heapLength);
  });

  it('Should remove root item from heap', async () => {
    const { contract, otherAccount, heapLength } = await loadFixture(prepareHeap);

    let gasUsed = Number.MAX_VALUE;
    for (let i = 0; i < heapLength; i++) {
      const removeItemTx = await contract.connect(otherAccount).remove(0);
      const receipt = await removeItemTx.wait();
      const currentGasUsed = receipt.gasUsed.toNumber();

      if (currentGasUsed < gasUsed) {
        gasUsed = currentGasUsed;
        gasBenchmarks.push({
          method: '.remove(0)',
          length: heapLength - i,
          gasUsed: gasUsed,
        });
      }
    }

    expect((await contract.getHeapLength()).toNumber()).to.equal(0);
  });

  it('Should update item', async () => {
    const { contract, otherAccount, heapLength } = await loadFixture(prepareHeap);

    //update top to bottom
    {
      const topToBottomTx = await contract.connect(otherAccount).updateByIndex(0, 0);
      const receipt = await topToBottomTx.wait();
      const currentGasUsed = receipt.gasUsed.toNumber();
      gasBenchmarks.push({
        method: 'update (top to bottom)',
        length: heapLength,
        gasUsed: currentGasUsed,
      });
    }

    // bottom to top
    {
      const lastElementIndex = heapLength - 1;
      const bottomToTop = await contract.connect(otherAccount).updateByIndex(lastElementIndex, 2000);
      const receipt = await bottomToTop.wait();
      const currentGasUsed = receipt.gasUsed.toNumber();
      gasBenchmarks.push({
        method: 'update (bottom to top)',
        length: heapLength,
        gasUsed: currentGasUsed,
      });
    }

    // update middle to top
    {
      const middleElementIndex = heapLength / 2;
      const bottomToTop = await contract.connect(otherAccount).updateByIndex(middleElementIndex, 2000);
      const receipt = await bottomToTop.wait();
      const currentGasUsed = receipt.gasUsed.toNumber();
      gasBenchmarks.push({
        method: 'update (middle to top)',
        length: heapLength,
        gasUsed: currentGasUsed,
      });
    }
  });
});
