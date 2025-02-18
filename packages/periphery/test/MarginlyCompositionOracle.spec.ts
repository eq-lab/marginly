import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ZERO_ADDRESS, createEmptyMarginlyCompositeOracle, createMarginlyCompositeOracle } from './shared/fixtures';

describe('MarginlyCompositeOracle', () => {
  it('should fail when zero address passed', async () => {
    const oracle = await loadFixture(createEmptyMarginlyCompositeOracle);
    const quote = '0x0000000000000000000000000000000000000001';
    const interm = '0x0000000000000000000000000000000000000002';
    const base = '0x0000000000000000000000000000000000000003';
    const oracle1 = '0x0000000000000000000000000000000000000004';

    await expect(oracle.setPair(ZERO_ADDRESS, interm, base, ZERO_ADDRESS, ZERO_ADDRESS)).to.be.revertedWithCustomError(
      oracle,
      'ZeroAddress'
    );

    await expect(oracle.setPair(quote, ZERO_ADDRESS, base, ZERO_ADDRESS, ZERO_ADDRESS)).to.be.revertedWithCustomError(
      oracle,
      'ZeroAddress'
    );

    await expect(oracle.setPair(quote, interm, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS)).to.be.revertedWithCustomError(
      oracle,
      'ZeroAddress'
    );

    await expect(oracle.setPair(quote, interm, base, ZERO_ADDRESS, oracle1)).to.be.revertedWithCustomError(
      oracle,
      'ZeroAddress'
    );

    await expect(oracle.setPair(quote, interm, base, oracle1, ZERO_ADDRESS)).to.be.revertedWithCustomError(
      oracle,
      'ZeroAddress'
    );
  });

  it('should return price weth/usdc with arb intermediate', async () => {
    const { oracle, quoteToken: usdc, baseToken: weth } = await loadFixture(createMarginlyCompositeOracle);

    const balancePrice = await oracle.getBalancePrice(usdc.address, weth.address);
    console.log(balancePrice);

    const mcPrice = await oracle.getMargincallPrice(usdc.address, weth.address);
    console.log(mcPrice);
  });

  it('should return price usdc/weth with usdc intermediate', async () => {
    const { oracle, quoteToken: usdc, baseToken: weth } = await loadFixture(createMarginlyCompositeOracle);

    const balancePrice = await oracle.getBalancePrice(weth.address, usdc.address);
    console.log(balancePrice);

    const mcPrice = await oracle.getMargincallPrice(weth.address, usdc.address);
    console.log(mcPrice);
  });

  it('should fail when pair not initialized', async () => {
    const {
      oracle,
      quoteToken: usdc,
      baseToken: weth,
      intermediateToken: arb,
    } = await loadFixture(createMarginlyCompositeOracle);

    await expect(oracle.getBalancePrice(arb.address, usdc.address)).to.be.revertedWithCustomError(
      oracle,
      'NotInitialized'
    );

    await expect(oracle.getBalancePrice(usdc.address, arb.address)).to.be.revertedWithCustomError(
      oracle,
      'NotInitialized'
    );

    await expect(oracle.getMargincallPrice(arb.address, usdc.address)).to.be.revertedWithCustomError(
      oracle,
      'NotInitialized'
    );

    await expect(oracle.getMargincallPrice(usdc.address, arb.address)).to.be.revertedWithCustomError(
      oracle,
      'NotInitialized'
    );
  });
});
