import { expect } from 'chai';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { BigNumber } from 'ethers';
import { createSomeChainlinkCompositeOracle, createSomeChainlinkOracle } from './shared/fixtures';
import { ethers } from 'hardhat';

describe('ChainlinkOracle prices', () => {
  for (const getPrice of ['getBalancePrice', 'getMargincallPrice']) {
    it(`${getPrice} forward`, async () => {
      const { oracle, chainlink, decimals, quoteToken, baseToken } = await loadFixture(createSomeChainlinkOracle);
      await chainlink.setPrice(5n * 10n ** (BigInt(decimals) - 1n)); // 0.5

      const quoteDecimals = await (await ethers.getContractAt('IERC20Metadata', quoteToken)).decimals();
      const baseDecimals = await (await ethers.getContractAt('IERC20Metadata', baseToken)).decimals();

      const expectedPrice = BigNumber.from(1n << 95n)
        .mul(BigNumber.from(10).pow(quoteDecimals))
        .div(BigNumber.from(10).pow(baseDecimals)); // 0.5

      const actualPrice = await (oracle as any)[getPrice](quoteToken, baseToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} backward`, async () => {
      const { oracle, chainlink, decimals, quoteToken, baseToken } = await loadFixture(createSomeChainlinkOracle);
      await chainlink.setPrice(5n * 10n ** (BigInt(decimals) - 1n)); // 0.5

      const quoteDecimals = await (await ethers.getContractAt('IERC20Metadata', quoteToken)).decimals();
      const baseDecimals = await (await ethers.getContractAt('IERC20Metadata', baseToken)).decimals();

      const expectedPrice = BigNumber.from(1n << 97n)
        .mul(BigNumber.from(10).pow(baseDecimals))
        .div(BigNumber.from(10).pow(quoteDecimals)); // 2

      const actualPrice = await (oracle as any)[getPrice](baseToken, quoteToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} composite price`, async () => {
      const { oracle, quoteChainlink, baseChainlink, quoteToken, baseToken, quoteDecimals, baseDecimals } =
        await loadFixture(createSomeChainlinkCompositeOracle);
      await quoteChainlink.setPrice(2000n * 10n ** BigInt(quoteDecimals));
      await baseChainlink.setPrice(40000n * 10n ** BigInt(baseDecimals));

      const expectedPrice = BigNumber.from(20n << 96n)
        .mul(BigNumber.from(10).pow(quoteDecimals))
        .div(BigNumber.from(10).pow(baseDecimals));

      const actualPrice = await (oracle as any)[getPrice](quoteToken, baseToken);
      expect(actualPrice).to.be.equal(expectedPrice);
    });

    it(`${getPrice} should fail when contract paused`, async () => {
      const { oracle, chainlink, decimals, quoteToken, baseToken } = await loadFixture(createSomeChainlinkOracle);
      await chainlink.setPrice(5n * 10n ** (BigInt(decimals) - 1n)); // 0.5

      await oracle.pause();
      await expect((oracle as any)[getPrice](quoteToken, baseToken)).to.be.revertedWith('Pausable: paused');

      await oracle.unpause();
      await (oracle as any)[getPrice](quoteToken, baseToken);
    });
  }

  it('setPair should fail when wrong maxPriceAge provided', async () => {
    const { oracle } = await loadFixture(createSomeChainlinkOracle);

    const token1 = '0x0000000000000000000000000000000000000001';
    const token2 = '0x0000000000000000000000000000000000000002';
    const dataFeed = '0x000000000000000000000000000000000000000f';

    await expect(oracle.setPair(token1, token2, dataFeed, 0)).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('getPrice should fail when price is stale', async () => {
    const { oracle, chainlink, quoteToken, baseToken } = await loadFixture(createSomeChainlinkOracle);

    await chainlink.setUpdatedAt(0);

    await expect(oracle.getBalancePrice(quoteToken, baseToken)).to.be.revertedWithCustomError(oracle, 'StalePrice');
    await expect(oracle.getMargincallPrice(quoteToken, baseToken)).to.be.revertedWithCustomError(oracle, 'StalePrice');
  });

  it('getPrice should fail when sequencer is down', async () => {
    const { oracle, quoteToken, baseToken, sequencerFeed } = await loadFixture(createSomeChainlinkOracle);

    await sequencerFeed.setAnswer(1, 0);

    await expect(oracle.getBalancePrice(quoteToken, baseToken)).to.be.revertedWithCustomError(
      oracle,
      'SequencerIsDown'
    );
    await expect(oracle.getMargincallPrice(quoteToken, baseToken)).to.be.revertedWithCustomError(
      oracle,
      'SequencerIsDown'
    );
  });

  it('getPrice should fail when sequencer grace period is not over', async () => {
    const { oracle, quoteToken, baseToken, sequencerFeed, chainlink } = await loadFixture(createSomeChainlinkOracle);
    await chainlink.setPrice(5n * 10n ** (BigInt(18) - 1n)); // 0.5
    const currentTimestamp = await time.latest();

    await sequencerFeed.setAnswer(0, currentTimestamp);
    await expect(oracle.getMargincallPrice(quoteToken, baseToken)).to.be.revertedWithCustomError(
      oracle,
      'SequencerGracePeriodNotOver'
    );
    await expect(oracle.getBalancePrice(quoteToken, baseToken)).to.be.revertedWithCustomError(
      oracle,
      'SequencerGracePeriodNotOver'
    );

    await sequencerFeed.setAnswer(0, currentTimestamp - (await oracle.sequencerGracePeriod()).toNumber());
    await oracle.getMargincallPrice(quoteToken, baseToken);
    await oracle.getBalancePrice(quoteToken, baseToken);
  });

  it('only owner could change sequencer grace period', async () => {
    const { oracle } = await loadFixture(createSomeChainlinkOracle);
    const [owner, notOwner] = await ethers.getSigners();

    await oracle.connect(owner).updateSequencerGracePeriod(0);

    await expect(oracle.connect(notOwner).updateSequencerGracePeriod(1)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(oracle.connect(notOwner).updateSequencerGracePeriod(1)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('only owner could pause contract', async () => {
    const { oracle } = await loadFixture(createSomeChainlinkOracle);
    const [owner, notOwner] = await ethers.getSigners();

    await oracle.connect(owner).pause();
    await oracle.connect(owner).unpause();

    await expect(oracle.connect(notOwner).pause()).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(oracle.connect(notOwner).unpause()).to.be.revertedWith('Ownable: caller is not the owner');
  });
});
