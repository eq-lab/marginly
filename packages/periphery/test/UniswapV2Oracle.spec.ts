import { expect } from 'chai';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import {
  Tokens,
  createUniswapV2Oracle,
  createUniswapV2OracleWithPairs,
  createUniswapV2OracleWithPairsAndObservations,
} from './shared/fixtures';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

function getPairKey(pair: string, baseToken: string, quoteToken: string) {
  return BigNumber.from(baseToken).lt(BigNumber.from(quoteToken)) ? BigNumber.from(pair) : BigNumber.from(pair).mul(-1);
}

describe('UniswapV2Oracle prices', () => {
  it('addPairs should work', async () => {
    const { oracle, pairs } = await loadFixture(createUniswapV2Oracle);

    expect(oracle.pairOptions);

    const pairOptions = [
      { secondsAgo: 1800, secondsAgoLiquidation: 60 },
      { secondsAgo: 1800, secondsAgoLiquidation: 90 },
    ];

    const pairsToAdd = [
      { baseToken: Tokens.WETH, quoteToken: Tokens.USDC },
      { quoteToken: Tokens.WETH, baseToken: Tokens.WBTC },
    ];

    const expectedPairKey0 = getPairKey(pairs[0].address, Tokens.WETH, Tokens.USDC);
    const expectedPairKey1 = getPairKey(pairs[1].address, Tokens.WBTC, Tokens.WETH);

    await oracle.addPairs(pairsToAdd, pairOptions);

    expect(await oracle.pairKeys(0)).to.be.equal(expectedPairKey0);
    expect(await oracle.pairKeys(1)).to.be.equal(expectedPairKey1);

    for (let i = 0; i < pairsToAdd.length; i++) {
      const pairKey = getPairKey(pairs[i].address, pairsToAdd[i].baseToken, pairsToAdd[i].quoteToken);
      const actualOption = await oracle.pairOptions(pairKey);
      expect(actualOption.secondsAgo).to.be.equal(pairOptions[i].secondsAgo);
      expect(actualOption.secondsAgoLiquidation).to.be.equal(pairOptions[i].secondsAgoLiquidation);
    }

    const granularity = await oracle.granularity();
    const lastObservationIndex = granularity - 1;
    for (let i = 0; i < pairs.length; i++) {
      const pairKey = getPairKey(pairs[i].address, pairsToAdd[i].baseToken, pairsToAdd[i].quoteToken);
      const actualObservation = await oracle.pairObservations(pairKey, lastObservationIndex);
      expect(actualObservation.timestamp).to.be.eq(0);
      expect(actualObservation.priceCumulative).to.be.eq(0);
    }
  });

  it('addPairs should fail when pair already exists', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    await expect(
      oracle.addPairs(
        [{ baseToken: Tokens.WETH, quoteToken: Tokens.USDC }],
        [{ secondsAgo: 1800, secondsAgoLiquidation: 60 }]
      )
    ).to.be.revertedWithCustomError(oracle, 'PairAlreadyExists');
  });

  it('addPairs should fail when pair not found', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    await expect(
      oracle.addPairs(
        [{ baseToken: Tokens.WETH, quoteToken: Tokens.WETH }],
        [{ secondsAgo: 1800, secondsAgoLiquidation: 60 }]
      )
    ).to.be.revertedWithCustomError(oracle, 'PairNotFound');
  });

  it('addPairs should fail when wrong options passed', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    await expect(
      oracle.addPairs([{ baseToken: Tokens.WETH, quoteToken: Tokens.USDC }], [])
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');

    await expect(
      oracle.addPairs(
        [{ baseToken: Tokens.WETH, quoteToken: Tokens.USDC }],
        [
          { secondsAgo: 1800, secondsAgoLiquidation: 60 },
          { secondsAgo: 1800, secondsAgoLiquidation: 60 },
        ]
      )
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('addPairs should fail when secondsAgo less than granularity', async () => {
    const { oracle } = await loadFixture(createUniswapV2Oracle);
    const granularity = await oracle.granularity();
    await expect(
      oracle.addPairs(
        [{ baseToken: Tokens.WETH, quoteToken: Tokens.USDC }],
        [{ secondsAgo: granularity - 1, secondsAgoLiquidation: granularity }]
      )
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');

    await expect(
      oracle.addPairs(
        [{ baseToken: Tokens.WETH, quoteToken: Tokens.USDC }],
        [{ secondsAgo: granularity, secondsAgoLiquidation: granularity - 1 }]
      )
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('addPairs should fail when secondsAgo greater than windowSize', async () => {
    const { oracle } = await loadFixture(createUniswapV2Oracle);
    const windowSize = await oracle.windowSize();
    await expect(
      oracle.addPairs(
        [{ baseToken: Tokens.WETH, quoteToken: Tokens.USDC }],
        [{ secondsAgo: windowSize, secondsAgoLiquidation: windowSize.add(1) }]
      )
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');

    await expect(
      oracle.addPairs(
        [{ baseToken: Tokens.WETH, quoteToken: Tokens.USDC }],
        [{ secondsAgo: windowSize.add(1), secondsAgoLiquidation: windowSize }]
      )
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('addPairs should fail when caller not an owner', async () => {
    let { oracle } = await loadFixture(createUniswapV2Oracle);
    const [, notAnOwner] = await ethers.getSigners();
    oracle = oracle.connect(notAnOwner);
    await expect(
      oracle.addPairs(
        [{ baseToken: Tokens.WETH, quoteToken: Tokens.USDC }],
        [{ secondsAgo: 60, secondsAgoLiquidation: 60 }]
      )
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('removePairs should fail when caller not an owner', async () => {
    let { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    const [, notAnOwner] = await ethers.getSigners();
    oracle = oracle.connect(notAnOwner);

    await expect(oracle.removePairAt(0)).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('removePair should replace last pair at first place', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);

    const firstPairKey = await oracle.pairKeys(0);
    const secondPairKey = await oracle.pairKeys(1);

    expect(await oracle.pairKeys(0)).to.be.equal(firstPairKey);
    expect(await oracle.pairKeys(1)).to.be.equal(secondPairKey);

    await oracle.removePairAt(0);

    expect(await oracle.pairKeys(0)).to.be.equal(secondPairKey);
  });

  it('remove last pair', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);

    const firstPairKey = await oracle.pairKeys(0);
    const secondPairKey = await oracle.pairKeys(1);

    expect(await oracle.pairKeys(0)).to.be.equal(firstPairKey);
    expect(await oracle.pairKeys(1)).to.be.equal(secondPairKey);

    await oracle.removePairAt(1);

    expect(await oracle.pairKeys(0)).to.be.equal(firstPairKey);
  });

  it('remove all pairs', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);

    const firstPairKey = await oracle.pairKeys(0);
    const secondPairKey = await oracle.pairKeys(1);

    expect(await oracle.pairKeys(0)).to.be.equal(firstPairKey);
    expect(await oracle.pairKeys(1)).to.be.equal(secondPairKey);

    await oracle.removePairAt(0);
    await oracle.removePairAt(0);
  });

  it('update single pair', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);

    const timestamp = await time.latest();
    const targetObservationIndex = await oracle.observationIndexOf(timestamp + 60);
    const pairKey = await oracle.pairKeys(0);

    const observationBefore = await oracle.pairObservations(pairKey, targetObservationIndex);
    expect(observationBefore.timestamp).to.be.eq(0);
    expect(observationBefore.priceCumulative).to.be.eq(0);

    await time.increase(60);
    await oracle.update(pairKey);

    const granularity = await oracle.granularity();
    for (let i = 0; i < granularity; i++) {
      const observationAfter = await oracle.pairObservations(pairKey, i);
      if (i == targetObservationIndex) {
        expect(observationAfter.timestamp).not.to.be.eq(0);
        expect(observationAfter.priceCumulative).not.to.be.eq(0);
      } else {
        expect(observationAfter.timestamp).to.be.eq(0);
        expect(observationAfter.priceCumulative).to.be.eq(0);
      }
    }
  });

  it('update not existed pair should fail', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);

    const notExistedPair = '0x0000000000000000000000000000000000000001';
    const notExistedPairKey = getPairKey(notExistedPair, Tokens.WETH, Tokens.USDC);

    await time.increase(60);
    await expect(oracle.update(notExistedPairKey)).to.be.reverted;
  });

  it('updateAll when no pairs', async () => {
    const { oracle } = await loadFixture(createUniswapV2Oracle);
    await oracle.updateAll();
  });

  it('updateAll should work', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    const granularity = await oracle.granularity();

    //expect all observations are empty
    for (let j = 0; j < 2; j++) {
      const pairKey = await oracle.pairKeys(j);
      for (let i = 0; i < granularity; i++) {
        const observation = await oracle.pairObservations(pairKey, i);
        expect(observation.timestamp).to.be.eq(0);
        expect(observation.priceCumulative).to.be.eq(0);
      }
    }

    for (let i = 0; i < 120; i++) {
      await time.increase(60);
      await oracle.updateAll();
    }

    //expect all observations were filled
    for (let j = 0; j < 2; j++) {
      const pairKey = await oracle.pairKeys(j);
      for (let i = 0; i < granularity; i++) {
        const observation = await oracle.pairObservations(pairKey, i);
        expect(observation.timestamp).not.to.be.eq(0);
        expect(observation.priceCumulative).not.to.be.eq(0);
      }
    }
  });

  it('only operator could call update', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    const [, notAnOperator] = await ethers.getSigners();
    expect(await oracle.operators(notAnOperator.address)).to.be.equal(false);
    const pairKey = await oracle.pairKeys(0);
    await expect(oracle.connect(notAnOperator).update(pairKey)).to.be.revertedWithCustomError(
      oracle,
      'UnauthorizedAccount'
    );

    await oracle.addOperator(notAnOperator.address);
    expect(await oracle.operators(notAnOperator.address)).to.be.equal(true);

    await oracle.connect(notAnOperator).update(pairKey);
  });

  it('only operator could call updateAll', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    const [, notAnOperator] = await ethers.getSigners();
    expect(await oracle.operators(notAnOperator.address)).to.be.equal(false);

    await expect(oracle.connect(notAnOperator).updateAll()).to.be.revertedWithCustomError(
      oracle,
      'UnauthorizedAccount'
    );

    await oracle.addOperator(notAnOperator.address);
    expect(await oracle.operators(notAnOperator.address)).to.be.equal(true);

    await oracle.connect(notAnOperator).updateAll();
  });

  it('updateAll should work with update', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);

    const timestamp = await time.latest();
    const targetObservationIndex = await oracle.observationIndexOf(timestamp + 60);
    const pairKey0 = await oracle.pairKeys(0);

    const observationBefore = await oracle.pairObservations(pairKey0, targetObservationIndex);
    expect(observationBefore.timestamp).to.be.eq(0);
    expect(observationBefore.priceCumulative).to.be.eq(0);

    await time.increase(60);
    await oracle.update(pairKey0);

    const granularity = await oracle.granularity();

    for (let i = 0; i < granularity; i++) {
      const observationAfter = await oracle.pairObservations(pairKey0, i);
      if (i == targetObservationIndex) {
        expect(observationAfter.timestamp).not.to.be.eq(0);
        expect(observationAfter.priceCumulative).not.to.be.eq(0);
      } else {
        expect(observationAfter.timestamp).to.be.eq(0);
        expect(observationAfter.priceCumulative).to.be.eq(0);
      }
    }

    const pairKey1 = await oracle.pairKeys(1);
    for (let i = 0; i < granularity; i++) {
      const observationAfter = await oracle.pairObservations(pairKey1, i);
      expect(observationAfter.timestamp.toBigInt()).to.be.eq(0n);
      expect(observationAfter.priceCumulative.toBigInt()).to.be.eq(0n);
    }

    await oracle.updateAll();

    const observationAfter = await oracle.pairObservations(pairKey1, targetObservationIndex);
    expect(observationAfter.timestamp.toBigInt()).not.to.be.eq(0n);
    expect(observationAfter.priceCumulative.toBigInt()).not.to.be.eq(0n);
  });

  it('updateAll then update', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    const granularity = await oracle.granularity();

    //expect all observations are empty
    for (let i = 0; i < granularity; i++) {
      for (let j = 0; j < 2; j++) {
        const observation = await oracle.pairObservations(await oracle.pairKeys(j), i);
        expect(observation.timestamp).to.be.eq(0);
        expect(observation.priceCumulative).to.be.eq(0);
      }
    }

    const timestamp = await time.latest();
    const targetObservationIndex = await oracle.observationIndexOf(timestamp + 60);

    await time.increase(60);
    await oracle.updateAll();

    const pairKey0 = await oracle.pairKeys(0);
    const observationBefore = await oracle.pairObservations(pairKey0, targetObservationIndex);
    expect(observationBefore.timestamp).not.to.be.eq(0);
    expect(observationBefore.priceCumulative).not.to.be.eq(0);

    await oracle.update(pairKey0);
    const observationAfter = await oracle.pairObservations(pairKey0, targetObservationIndex);
    expect(observationAfter.timestamp).to.be.eq(observationBefore.timestamp);
    expect(observationAfter.priceCumulative).to.be.eq(observationBefore.priceCumulative);
  });

  it('getBalancePrice should fail when no observations', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    await expect(oracle.getBalancePrice(Tokens.USDC, Tokens.WETH)).to.be.revertedWithCustomError(
      oracle,
      'MissingHistoricalObservation'
    );
  });

  it('getMCPrice should fail when no observations', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    await expect(oracle.getMargincallPrice(Tokens.USDC, Tokens.WETH)).to.be.revertedWithCustomError(
      oracle,
      'MissingHistoricalObservation'
    );
  });

  it('getBalancePrice should work', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairsAndObservations);

    const balancePriceRaw = await oracle.getBalancePrice(Tokens.USDC, Tokens.WETH);
    const balancePrice = balancePriceRaw.mul(10n ** 12n).div(2n ** 96n);
    expect(balancePrice).to.be.eq(3579);
    console.log(`Balance price is ${balancePrice}`);
  });

  it('getMargincallPrice should work', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairsAndObservations);

    const mcPriceRaw = await oracle.getMargincallPrice(Tokens.USDC, Tokens.WETH);
    const mcPrice = mcPriceRaw.mul(10n ** 12n).div(2n ** 96n);
    expect(mcPrice).to.be.eq(3579);
    console.log(`MC price is ${mcPrice}`);
  });

  it('getBalancePrice backward should fail', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairsAndObservations);
    await expect(oracle.getBalancePrice(Tokens.WETH, Tokens.USDC)).to.be.reverted;
  });

  it('getMargincallPrice backward should fail', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairsAndObservations);
    await expect(oracle.getMargincallPrice(Tokens.WETH, Tokens.USDC)).to.be.reverted;
  });

  it('getBalancePrice should fail for not existed in oracle pair', async () => {
    const { oracle } = await loadFixture(createUniswapV2Oracle);
    await expect(oracle.getBalancePrice(Tokens.USDC, Tokens.WETH)).to.be.reverted;
    await expect(oracle.getBalancePrice(Tokens.WETH, Tokens.USDC)).to.be.reverted;
  });

  it('getMCPrice should fail for not existed in oracle pair', async () => {
    const { oracle } = await loadFixture(createUniswapV2Oracle);
    await expect(oracle.getMargincallPrice(Tokens.USDC, Tokens.WETH)).to.be.reverted;
    await expect(oracle.getMargincallPrice(Tokens.WETH, Tokens.USDC)).to.be.reverted;
  });

  it('getBalance price should fail when too much updates were skipped', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairsAndObservations);

    for (let i = 0; i < 31; i++) {
      await time.increase(60);
    }

    await expect(oracle.getBalancePrice(Tokens.USDC, Tokens.WETH)).to.be.revertedWithCustomError(
      oracle,
      'MissingHistoricalObservation'
    );
  });

  it('getMCPrice should fail when two updates were skipped', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairsAndObservations);

    await oracle.getMargincallPrice(Tokens.USDC, Tokens.WETH);

    await time.increase(60);
    await time.increase(60);

    // all observations data
    // const granularity = await oracle.granularity();
    // const pairKey = await oracle.pairKeys(0);

    // console.log(`Latest block timestamp ${await time.latest()}`);
    // for (let i = 0; i < granularity; i++) {
    //   const observation = await oracle.pairObservations(pairKey, i);
    //   console.log(`Observation ${i}:`);
    //   console.log(`  timestamp: ${observation.timestamp}`);
    //   console.log(`  price: ${observation.priceCumulative}`);
    // }

    await expect(oracle.getMargincallPrice(Tokens.USDC, Tokens.WETH)).to.be.revertedWithCustomError(
      oracle,
      'MissingHistoricalObservation'
    );
  });

  it('only owner could add new operators', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    const [, signer1, signer2] = await ethers.getSigners();
    expect(await oracle.operators(signer1.address)).to.be.equal(false);
    expect(await oracle.operators(signer2.address)).to.be.equal(false);

    await oracle.addOperator(signer1.address);
    expect(await oracle.operators(signer1.address)).to.be.equal(true);

    await expect(oracle.connect(signer2).addOperator(signer2.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(oracle.connect(signer1).addOperator(signer2.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });

  it('only owner could remove operators', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    const [, signer1, signer2, signer3] = await ethers.getSigners();
    await oracle.addOperator(signer1.address);
    await oracle.addOperator(signer2.address);

    expect(await oracle.operators(signer1.address)).to.be.equal(true);
    expect(await oracle.operators(signer2.address)).to.be.equal(true);
    expect(await oracle.operators(signer3.address)).to.be.equal(false);

    await expect(oracle.connect(signer2).removeOperator(signer1.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(oracle.connect(signer3).removeOperator(signer1.address)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );

    await oracle.removeOperator(signer1.address);
    await oracle.removeOperator(signer2.address);
    expect(await oracle.operators(signer1.address)).to.be.equal(false);
    expect(await oracle.operators(signer2.address)).to.be.equal(false);

    //no effects
    await oracle.removeOperator(signer3.address);
    expect(await oracle.operators(signer3.address)).to.be.equal(false);
  });
});
