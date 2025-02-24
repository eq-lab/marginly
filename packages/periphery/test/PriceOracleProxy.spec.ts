import { ethers } from 'hardhat';
import { expect } from 'chai';
import { MockPriceOracleV2, PriceOracleProxy } from '../typechain-types';
import { BigNumber, Signer } from 'ethers';

describe('PriceOracleProxy', () => {
  let owner: Signer;
  let nonOwner: Signer;
  let underlyingPriceOracle: MockPriceOracleV2;
  let priceOracle: PriceOracleProxy;
  const baseToken = '0x0000000000000000000000000000000000000001';
  const quoteToken = '0x0000000000000000000000000000000000000002';
  const underlyingBaseToken = '0x0000000000000000000000000000000000000010';
  const underlyingQuoteToken = '0x0000000000000000000000000000000000000020';

  const balancePriceX96 = 1n;
  const mcPriceX96 = 2n;

  const x96One = BigNumber.from(2).pow(96);

  beforeEach(async () => {
    [owner, nonOwner] = await ethers.getSigners();
    // deploy contracts
    underlyingPriceOracle = await (await ethers.getContractFactory('MockPriceOracleV2')).deploy();
    await underlyingPriceOracle.setPrice(underlyingQuoteToken, underlyingBaseToken, balancePriceX96, mcPriceX96);

    priceOracle = await (await ethers.getContractFactory('PriceOracleProxy', owner)).deploy();
    await priceOracle.setPair(
      quoteToken,
      baseToken,
      underlyingQuoteToken,
      underlyingBaseToken,
      underlyingPriceOracle.address
    );
  });

  it('should return balance price in quote currency', async () => {
    const price = await priceOracle.getBalancePrice(quoteToken, baseToken);
    expect(price).to.equal(balancePriceX96);

    const invPrice = await priceOracle.getBalancePrice(baseToken, quoteToken);
    expect(invPrice).to.equal(x96One.mul(x96One).div(balancePriceX96));
  });

  it('should fail to return balance price in quote currency if pair not exists', async () => {
    const nonExistentToken = '0x0000000000000000000000000000000000000003';
    await expect(priceOracle.getBalancePrice(nonExistentToken, baseToken)).to.be.revertedWithCustomError(
      priceOracle,
      'NotInitialized'
    );
  });

  it('should return mc price in quote currency', async () => {
    const price = await priceOracle.getMargincallPrice(quoteToken, baseToken);
    expect(price).to.equal(mcPriceX96);

    const invPrice = await priceOracle.getMargincallPrice(baseToken, quoteToken);
    expect(invPrice).to.equal(x96One.mul(x96One).div(mcPriceX96));
  });

  it('should fail to return mc price in quote currency if pair not exists', async () => {
    const nonExistentToken = '0x0000000000000000000000000000000000000003';
    await expect(priceOracle.getMargincallPrice(nonExistentToken, baseToken)).to.be.revertedWithCustomError(
      priceOracle,
      'NotInitialized'
    );
  });

  it('should fail when underlying price oracle returns zero balance price', async () => {
    await underlyingPriceOracle.setPrice(underlyingQuoteToken, underlyingBaseToken, 0, mcPriceX96);

    await expect(priceOracle.getBalancePrice(quoteToken, baseToken)).to.be.revertedWithCustomError(
      priceOracle,
      'ZeroPrice'
    );
  });

  it('should fail when underlying price oracle returns zero mc price', async () => {
    await underlyingPriceOracle.setPrice(underlyingQuoteToken, underlyingBaseToken, balancePriceX96, 0);
    await expect(priceOracle.getMargincallPrice(quoteToken, baseToken)).to.be.revertedWithCustomError(
      priceOracle,
      'ZeroPrice'
    );
  });

  it('should only allow the owner to call setPair', async () => {
    await expect(
      priceOracle
        .connect(nonOwner)
        .setPair(quoteToken, baseToken, underlyingQuoteToken, underlyingBaseToken, underlyingPriceOracle.address)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should set pair correctly', async () => {
    const newBaseToken = '0x0000000000000000000000000000000000000004';
    const newQuoteToken = '0x0000000000000000000000000000000000000005';
    const undNewBaseToken = '0x0000000000000000000000000000000000000040';
    const undNewQuoteToken = '0x0000000000000000000000000000000000000050';

    await underlyingPriceOracle.setPrice(undNewQuoteToken, undNewBaseToken, balancePriceX96, mcPriceX96);

    await priceOracle.setPair(
      newQuoteToken,
      newBaseToken,
      undNewQuoteToken,
      undNewBaseToken,
      underlyingPriceOracle.address
    );
    const balancePrice = await priceOracle.getBalancePrice(newQuoteToken, newBaseToken);
    const mcPrice = await priceOracle.getMargincallPrice(newQuoteToken, newBaseToken);
    expect(balancePrice).to.equal(balancePriceX96);
    expect(mcPrice).to.equal(mcPriceX96);
  });

  it('should fail when setting up pair with zero address', async () => {
    await expect(
      priceOracle.setPair(
        ethers.constants.AddressZero,
        baseToken,
        underlyingQuoteToken,
        underlyingBaseToken,
        underlyingPriceOracle.address
      )
    ).to.be.revertedWithCustomError(priceOracle, 'ZeroAddress');

    await expect(
      priceOracle.setPair(
        quoteToken,
        ethers.constants.AddressZero,
        underlyingQuoteToken,
        underlyingBaseToken,
        underlyingPriceOracle.address
      )
    ).to.be.revertedWithCustomError(priceOracle, 'ZeroAddress');

    await expect(
      priceOracle.setPair(
        quoteToken,
        baseToken,
        ethers.constants.AddressZero,
        underlyingBaseToken,
        underlyingPriceOracle.address
      )
    ).to.be.revertedWithCustomError(priceOracle, 'ZeroAddress');

    await expect(
      priceOracle.setPair(
        quoteToken,
        baseToken,
        underlyingQuoteToken,
        ethers.constants.AddressZero,
        underlyingPriceOracle.address
      )
    ).to.be.revertedWithCustomError(priceOracle, 'ZeroAddress');

    await expect(
      priceOracle.setPair(
        quoteToken,
        baseToken,
        underlyingQuoteToken,
        underlyingBaseToken,
        ethers.constants.AddressZero
      )
    ).to.be.revertedWithCustomError(priceOracle, 'ZeroAddress');
  });

  it('should fail when setting up pair with same tokens', async () => {
    await expect(
      priceOracle.setPair(
        quoteToken,
        quoteToken,
        underlyingQuoteToken,
        underlyingBaseToken,
        ethers.constants.AddressZero
      )
    ).to.be.revertedWithCustomError(priceOracle, 'ZeroAddress');
  });

  it('should fail when setting up pair with zero price oracle', async () => {
    const token1 = '0x0000000000000000000000000000000000000004';
    const token2 = '0x0000000000000000000000000000000000000005';

    const expectError = async () => {
      await expect(
        priceOracle.setPair(token1, token2, token1, token2, underlyingPriceOracle.address)
      ).to.be.revertedWithCustomError(priceOracle, 'ZeroPrice');
    };

    await underlyingPriceOracle.setPrice(token1, token2, 0, 0);
    await expectError();

    await underlyingPriceOracle.setPrice(token1, token2, 0, 1);
    await expectError();

    await underlyingPriceOracle.setPrice(token1, token2, 1, 0);
    await expectError();
  });
});
