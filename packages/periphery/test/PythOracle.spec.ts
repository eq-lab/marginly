import { expect } from 'chai';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { createSomePythCompositeOracle, createSomePythOracle } from './shared/fixtures';

describe('PythOracle prices', () => {
  for (const getPrice of ['getBalancePrice', 'getMargincallPrice']) {
    it(`${getPrice} negative exponent forward`, async () => {
      const { oracle, pyth, pythId, quoteToken, baseToken } = await loadFixture(createSomePythOracle);
      const currentTime = await time.latest();
      await pyth.setPrice(pythId, 5, -1, currentTime); // 0.5

      const quoteDecimals = await (await ethers.getContractAt('IERC20Metadata', quoteToken)).decimals();
      const baseDecimals = await (await ethers.getContractAt('IERC20Metadata', baseToken)).decimals();

      const expectedPrice = BigNumber.from(1n << 95n)
        .mul(BigNumber.from(10).pow(quoteDecimals))
        .div(BigNumber.from(10).pow(baseDecimals)); // 0.5

      const actualPrice = await (oracle as any)[getPrice](quoteToken, baseToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} negative exponent backward`, async () => {
      const { oracle, pyth, pythId, quoteToken, baseToken } = await loadFixture(createSomePythOracle);
      const currentTime = await time.latest();
      await pyth.setPrice(pythId, 5, -1, currentTime); // 0.5

      const quoteDecimals = await (await ethers.getContractAt('IERC20Metadata', quoteToken)).decimals();
      const baseDecimals = await (await ethers.getContractAt('IERC20Metadata', baseToken)).decimals();

      const expectedPrice = BigNumber.from(1n << 97n)
        .mul(BigNumber.from(10).pow(baseDecimals))
        .div(BigNumber.from(10).pow(quoteDecimals)); // 2

      const actualPrice = await (oracle as any)[getPrice](baseToken, quoteToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} non-negative exponent forward`, async () => {
      const { oracle, pyth, pythId, quoteToken, baseToken } = await loadFixture(createSomePythOracle);
      const currentTime = await time.latest();
      await pyth.setPrice(pythId, 4, 0, currentTime); // 4

      const quoteDecimals = await (await ethers.getContractAt('IERC20Metadata', quoteToken)).decimals();
      const baseDecimals = await (await ethers.getContractAt('IERC20Metadata', baseToken)).decimals();

      const expectedPrice = BigNumber.from(1n << 98n)
        .mul(BigNumber.from(10).pow(quoteDecimals))
        .div(BigNumber.from(10).pow(baseDecimals)); // 4

      const actualPrice = await (oracle as any)[getPrice](quoteToken, baseToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} non-negative exponent backward`, async () => {
      const { oracle, pyth, pythId, quoteToken, baseToken } = await loadFixture(createSomePythOracle);
      const currentTime = await time.latest();
      await pyth.setPrice(pythId, 4, 0, currentTime); // 4

      const quoteDecimals = await (await ethers.getContractAt('IERC20Metadata', quoteToken)).decimals();
      const baseDecimals = await (await ethers.getContractAt('IERC20Metadata', baseToken)).decimals();

      const expectedPrice = BigNumber.from(1n << 94n)
        .mul(BigNumber.from(10).pow(baseDecimals))
        .div(BigNumber.from(10).pow(quoteDecimals)); // 0.25

      const actualPrice = await (oracle as any)[getPrice](baseToken, quoteToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} composite price`, async () => {
      const { oracle, pyth, quoteToken, baseToken, quotePythId, basePythId } = await loadFixture(
        createSomePythCompositeOracle
      );
      const currentTime = await time.latest();
      await pyth.setPrice(quotePythId, 2000, 0, currentTime);
      await pyth.setPrice(basePythId, 40000, 0, currentTime);

      const quoteDecimals = await (await ethers.getContractAt('IERC20Metadata', quoteToken)).decimals();
      const baseDecimals = await (await ethers.getContractAt('IERC20Metadata', baseToken)).decimals();

      const expectedPrice = BigNumber.from(20n << 96n)
        .mul(BigNumber.from(10).pow(quoteDecimals))
        .div(BigNumber.from(10).pow(baseDecimals));

      const actualPrice = await (oracle as any)[getPrice](quoteToken, baseToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} should fail when contract paused`, async () => {
      const { oracle, pyth, pythId, quoteToken, baseToken } = await loadFixture(createSomePythOracle);
      const currentTime = await time.latest();
      await pyth.setPrice(pythId, 5, -1, currentTime); // 0.5

      await oracle.pause();
      await expect((oracle as any)[getPrice](quoteToken, baseToken)).to.be.revertedWith('Pausable: paused');

      await oracle.unpause();
      await (oracle as any)[getPrice](quoteToken, baseToken);
    });

    it('getPrice should fail when price is stale', async () => {
      const { oracle, pyth, pythId, quoteToken, baseToken } = await loadFixture(createSomePythOracle);
      const publishTime = (await time.latest()) - 86400;
      await pyth.setPrice(pythId, 4, 0, publishTime); // 4

      await expect((oracle as any)[getPrice](quoteToken, baseToken)).to.be.revertedWithCustomError(pyth, 'StalePrice');
    });
  }

  it('setPair should fail when maxPriceAge param is zero', async () => {
    const { oracle, pythId, quoteToken, baseToken } = await loadFixture(createSomePythOracle);

    expect(oracle.setPair(quoteToken, baseToken, pythId, 0)).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('only owner could pause contract', async () => {
    const { oracle } = await loadFixture(createSomePythOracle);
    const [owner, notOwner] = await ethers.getSigners();

    await oracle.connect(owner).pause();
    await oracle.connect(owner).unpause();

    await expect(oracle.connect(notOwner).pause()).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(oracle.connect(notOwner).unpause()).to.be.revertedWith('Ownable: caller is not the owner');
  });
});
