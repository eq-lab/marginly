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

describe.only('UniswapV2Oracle prices', () => {
  it('addPairs should work', async () => {
    const { oracle, pairs } = await loadFixture(createUniswapV2Oracle);

    expect(oracle.pairOptions);

    const pairOptions = [
      { secondsAgo: 1800, secondsAgoLiquidation: 60 },
      { secondsAgo: 1800, secondsAgoLiquidation: 90 },
    ];

    const pairsToAdd = [
      { token0: Tokens.WETH, token1: Tokens.USDC },
      { token0: Tokens.WETH, token1: Tokens.WBTC },
    ];

    await oracle.addPairs(pairsToAdd, pairOptions);

    expect(await oracle.pairs(0)).to.be.equal(pairs[0].address);
    expect(await oracle.pairs(1)).to.be.equal(pairs[1].address);

    for (let i = 0; i < pairsToAdd.length; i++) {
      const actualOption = await oracle.pairOptions(pairs[i].address);
      expect(actualOption.secondsAgo).to.be.equal(pairOptions[i].secondsAgo);
      expect(actualOption.secondsAgoLiquidation).to.be.equal(pairOptions[i].secondsAgoLiquidation);
    }

    const granularity = await oracle.granularity();
    const lastObservationIndex = granularity - 1;
    for (let i = 0; i < pairs.length; i++) {
      const actualObservation = await oracle.pairObservations(pairs[i].address, lastObservationIndex);
      expect(actualObservation.timestamp).to.be.eq(0);
      expect(actualObservation.price0Cumulative).to.be.eq(0);
    }
  });

  it('addPairs should fail when pair already exists', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    await expect(
      oracle.addPairs([{ token0: Tokens.WETH, token1: Tokens.USDC }], [{ secondsAgo: 1800, secondsAgoLiquidation: 60 }])
    ).to.be.revertedWithCustomError(oracle, 'PairAlreadyExists');
  });

  it('addPairs should fail when pair not found', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    await expect(
      oracle.addPairs([{ token0: Tokens.WETH, token1: Tokens.WETH }], [{ secondsAgo: 1800, secondsAgoLiquidation: 60 }])
    ).to.be.revertedWithCustomError(oracle, 'PairNotFound');
  });

  it('addPairs should fail when wrong options passed', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    await expect(oracle.addPairs([{ token0: Tokens.WETH, token1: Tokens.WETH }], [])).to.be.revertedWithCustomError(
      oracle,
      'WrongValue'
    );

    await expect(
      oracle.addPairs(
        [{ token0: Tokens.WETH, token1: Tokens.WETH }],
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
        [{ token0: Tokens.WETH, token1: Tokens.USDC }],
        [{ secondsAgo: granularity - 1, secondsAgoLiquidation: granularity }]
      )
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');

    await expect(
      oracle.addPairs(
        [{ token0: Tokens.WETH, token1: Tokens.USDC }],
        [{ secondsAgo: granularity, secondsAgoLiquidation: granularity - 1 }]
      )
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('addPairs should fail when secondsAgo greater than windowSize', async () => {
    const { oracle } = await loadFixture(createUniswapV2Oracle);
    const windowSize = await oracle.windowSize();
    await expect(
      oracle.addPairs(
        [{ token0: Tokens.WETH, token1: Tokens.USDC }],
        [{ secondsAgo: windowSize, secondsAgoLiquidation: windowSize.add(1) }]
      )
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');

    await expect(
      oracle.addPairs(
        [{ token0: Tokens.WETH, token1: Tokens.USDC }],
        [{ secondsAgo: windowSize.add(1), secondsAgoLiquidation: windowSize }]
      )
    ).to.be.revertedWithCustomError(oracle, 'WrongValue');
  });

  it('addPairs should fail when caller not an owner', async () => {
    let { oracle } = await loadFixture(createUniswapV2Oracle);
    const [, notAnOwner] = await ethers.getSigners();
    oracle = oracle.connect(notAnOwner);
    await expect(
      oracle.addPairs([{ token0: Tokens.WETH, token1: Tokens.USDC }], [{ secondsAgo: 60, secondsAgoLiquidation: 60 }])
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

    const firstPair = await oracle.pairs(0);
    const secondPair = await oracle.pairs(1);

    expect(await oracle.pairs(0)).to.be.equal(firstPair);
    expect(await oracle.pairs(1)).to.be.equal(secondPair);

    await oracle.removePairAt(0);

    expect(await oracle.pairs(0)).to.be.equal(secondPair);
  });

  it('remove last pair', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);

    const firstPair = await oracle.pairs(0);
    const secondPair = await oracle.pairs(1);

    expect(await oracle.pairs(0)).to.be.equal(firstPair);
    expect(await oracle.pairs(1)).to.be.equal(secondPair);

    await oracle.removePairAt(1);

    expect(await oracle.pairs(0)).to.be.equal(firstPair);
  });

  it('remove all pairs', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);

    const firstPair = await oracle.pairs(0);
    const secondPair = await oracle.pairs(1);

    expect(await oracle.pairs(0)).to.be.equal(firstPair);
    expect(await oracle.pairs(1)).to.be.equal(secondPair);

    await oracle.removePairAt(0);
    await oracle.removePairAt(0);
  });

  it('update single pair', async () => {
    const { oracle, pairs } = await loadFixture(createUniswapV2OracleWithPairs);

    const timestamp = await time.latest();
    const targetObservationIndex = await oracle.observationIndexOf(timestamp + 60);

    const observationBefore = await oracle.pairObservations(pairs[0].address, targetObservationIndex);
    expect(observationBefore.timestamp).to.be.eq(0);
    expect(observationBefore.price0Cumulative).to.be.eq(0);

    await time.increase(60);
    await oracle.update(pairs[0].address);

    const granularity = await oracle.granularity();
    for (let i = 0; i < granularity; i++) {
      const observationAfter = await oracle.pairObservations(pairs[0].address, i);
      if (i == targetObservationIndex) {
        expect(observationAfter.timestamp).not.to.be.eq(0);
        expect(observationAfter.price0Cumulative).not.to.be.eq(0);
      } else {
        expect(observationAfter.timestamp).to.be.eq(0);
        expect(observationAfter.price0Cumulative).to.be.eq(0);
      }
    }
  });

  it('update not existed pair should fail', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);

    const notExistedPair = '0x0000000000000000000000000000000000000001';

    await time.increase(60);
    await expect(oracle.update(notExistedPair)).to.be.reverted;
  });

  it('updateAll when no pairs', async () => {
    const { oracle } = await loadFixture(createUniswapV2Oracle);
    await oracle.updateAll();
  });

  it('updateAll should work', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    const granularity = await oracle.granularity();

    //expect all observations are empty
    for (let i = 0; i < granularity; i++) {
      for (let j = 0; j < 2; j++) {
        const observation = await oracle.pairObservations(await oracle.pairs(j), i);
        expect(observation.timestamp).to.be.eq(0);
        expect(observation.price0Cumulative).to.be.eq(0);
      }
    }

    for (let i = 0; i < 120; i++) {
      await time.increase(60);
      await oracle.updateAll();
    }

    //expect all observations were filled
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < granularity; i++) {
        const observation = await oracle.pairObservations(await oracle.pairs(j), i);
        expect(observation.timestamp).not.to.be.eq(0);
        expect(observation.price0Cumulative).not.to.be.eq(0);
      }
    }
  });

  it('anybody can call update', async () => {
    const { oracle, pairs } = await loadFixture(createUniswapV2OracleWithPairs);
    const [, notAnOwner] = await ethers.getSigners();
    await oracle.connect(notAnOwner).update(pairs[0].address);
  });

  it('anybody can call updateAll', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairs);
    const [, notAnOwner] = await ethers.getSigners();
    await oracle.connect(notAnOwner).updateAll();
  });

  it('updateAll should work with update', async () => {
    const { oracle, pairs } = await loadFixture(createUniswapV2OracleWithPairs);

    const timestamp = await time.latest();
    const targetObservationIndex = await oracle.observationIndexOf(timestamp + 60);

    const observationBefore = await oracle.pairObservations(pairs[0].address, targetObservationIndex);
    expect(observationBefore.timestamp).to.be.eq(0);
    expect(observationBefore.price0Cumulative).to.be.eq(0);

    await time.increase(60);
    await oracle.update(pairs[0].address);

    const granularity = await oracle.granularity();
    for (let i = 0; i < granularity; i++) {
      const observationAfter = await oracle.pairObservations(pairs[0].address, i);
      if (i == targetObservationIndex) {
        expect(observationAfter.timestamp).not.to.be.eq(0);
        expect(observationAfter.price0Cumulative).not.to.be.eq(0);
      } else {
        expect(observationAfter.timestamp).to.be.eq(0);
        expect(observationAfter.price0Cumulative).to.be.eq(0);
      }
    }

    for (let i = 0; i < granularity; i++) {
      const observationAfter = await oracle.pairObservations(pairs[1].address, i);
      expect(observationAfter.timestamp).to.be.eq(0);
      expect(observationAfter.price0Cumulative).to.be.eq(0);
    }

    await oracle.updateAll();

    const observationAfter = await oracle.pairObservations(pairs[1].address, targetObservationIndex);
    expect(observationAfter.timestamp).not.to.be.eq(0);
    expect(observationAfter.price0Cumulative).not.to.be.eq(0);
  });

  it('updateAll then update', async () => {
    const { oracle, pairs } = await loadFixture(createUniswapV2OracleWithPairs);
    const granularity = await oracle.granularity();

    //expect all observations are empty
    for (let i = 0; i < granularity; i++) {
      for (let j = 0; j < 2; j++) {
        const observation = await oracle.pairObservations(await oracle.pairs(j), i);
        expect(observation.timestamp).to.be.eq(0);
        expect(observation.price0Cumulative).to.be.eq(0);
      }
    }

    const timestamp = await time.latest();
    const targetObservationIndex = await oracle.observationIndexOf(timestamp + 60);

    await time.increase(60);
    await oracle.updateAll();

    const observationBefore = await oracle.pairObservations(pairs[0].address, targetObservationIndex);
    expect(observationBefore.timestamp).not.to.be.eq(0);
    expect(observationBefore.price0Cumulative).not.to.be.eq(0);

    await oracle.update(pairs[0].address);
    const observationAfter = await oracle.pairObservations(pairs[0].address, targetObservationIndex);
    expect(observationAfter.timestamp).to.be.eq(observationBefore.timestamp);
    expect(observationAfter.price0Cumulative).to.be.eq(observationBefore.price0Cumulative);
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

  it('getBalancePrice backward', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairsAndObservations);
    const inversePrice = await oracle.getBalancePrice(Tokens.WETH, Tokens.USDC);
    const x96One = BigNumber.from(2).pow(96);
    expect(x96One.mul(10 ** 12).div(inversePrice)).to.be.eq(3579);
  });

  it('getMargincallPrice backward', async () => {
    const { oracle } = await loadFixture(createUniswapV2OracleWithPairsAndObservations);
    const inversePrice = await oracle.getMargincallPrice(Tokens.WETH, Tokens.USDC);
    const x96One = BigNumber.from(2).pow(96);
    expect(x96One.mul(10 ** 12).div(inversePrice)).to.be.eq(3579);
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
});
