import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  createSomePythCompositeOracle,
  createSomePythOracle,
} from './shared/fixtures';

describe('PythOracle prices', () => {
  for (const getPrice of ['getBalancePrice', 'getMargincallPrice']) {
    it(`${getPrice} negative exponent forward`, async () => {
      const { oracle, pyth, pythId, quoteToken, baseToken } = await loadFixture(createSomePythOracle);
      await pyth.setPrice(pythId, 5, -1); // 0.5

      const expectedPrice = BigNumber.from(1n << 95n); // 0.5

      const actualPrice = await (oracle as any)[getPrice](quoteToken, baseToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} negative exponent backward`, async () => {
      const { oracle, pyth, pythId, quoteToken, baseToken } = await loadFixture(createSomePythOracle);
      await pyth.setPrice(pythId, 5, -1); // 0.5

      const expectedPrice = BigNumber.from(1n << 97n); // 2

      const actualPrice = await (oracle as any)[getPrice](baseToken, quoteToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} non-negative exponent forward`, async () => {
      const { oracle, pyth, pythId, quoteToken, baseToken } = await loadFixture(createSomePythOracle);
      await pyth.setPrice(pythId, 4, 0); // 4

      const expectedPrice = BigNumber.from(1n << 98n); // 4

      const actualPrice = await (oracle as any)[getPrice](quoteToken, baseToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} non-negative exponent backward`, async () => {
      const { oracle, pyth, pythId, quoteToken, baseToken } = await loadFixture(createSomePythOracle);
      await pyth.setPrice(pythId, 4, 0); // 4

      const expectedPrice = BigNumber.from(1n << 94n); // 0.25

      const actualPrice = await (oracle as any)[getPrice](baseToken, quoteToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} composite price`, async () => {
      const { oracle, pyth, quoteToken, intermediateToken, baseToken, quotePythId, basePythId } = await loadFixture(createSomePythCompositeOracle);
      await pyth.setPrice(quotePythId, 2000, 0);
      await pyth.setPrice(basePythId, 40000, 0);

      const expectedPrice = BigNumber.from(20n << 96n);

      const actualPrice = await (oracle as any)[getPrice](quoteToken, baseToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });
  }
});