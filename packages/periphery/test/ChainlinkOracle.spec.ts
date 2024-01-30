import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  createSomeChainlinkCompositeOracle,
  createSomeChainlinkOracle, createSomePythCompositeOracle,
} from './shared/fixtures';

describe('ChainlinkOracle prices', () => {
  for (const getPrice of ['getBalancePrice', 'getMargincallPrice']) {
    it(`${getPrice} forward`, async () => {
      const { oracle, chainlink, decimals, quoteToken, baseToken } = await loadFixture(createSomeChainlinkOracle);
      await chainlink.setPrice(5n * 10n ** (BigInt(decimals) - 1n)); // 0.5

      const expectedPrice = BigNumber.from(1n << 95n); // 0.5

      const actualPrice = await (oracle as any)[getPrice](quoteToken, baseToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} backward`, async () => {
      const { oracle, chainlink, decimals, quoteToken, baseToken } = await loadFixture(createSomeChainlinkOracle);
      await chainlink.setPrice(5n * 10n ** (BigInt(decimals) - 1n)); // 0.5

      const expectedPrice = BigNumber.from(1n << 97n); // 2

      const actualPrice = await (oracle as any)[getPrice](baseToken, quoteToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} composite price`, async () => {
      const {
        oracle,
        quoteChainlink,
        baseChainlink,
        quoteToken,
        baseToken,
        quoteDecimals,
        baseDecimals,
      } = await loadFixture(createSomeChainlinkCompositeOracle);
      await quoteChainlink.setPrice(2000n * 10n ** BigInt(quoteDecimals));
      await baseChainlink.setPrice(40000n * 10n ** BigInt(baseDecimals));

      const expectedPrice = BigNumber.from(20n << 96n);

      const actualPrice = await (oracle as any)[getPrice](quoteToken, baseToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });
  }
});