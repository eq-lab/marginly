import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { createTestSwapInfo } from './shared/fixtures';
import { constructSwap, Dex, SWAP_ONE } from './shared/utils';

describe('SwapInfo decoding', () => {
  it('default', async () => {
    const swapInfoTest = await loadFixture(createTestSwapInfo);
    const defaultUniswapV3Swap = 0;
    const decodingResult = await swapInfoTest.decodeSwapInfo(defaultUniswapV3Swap);
    expect(decodingResult[1]).to.be.equal(1);

    const swapInfo = decodingResult[0][0];
    expect(swapInfo.dex).to.be.equal(Dex.UniswapV3);
    expect(swapInfo.swapRatio).to.be.equal(1 << 15);
  });

  it('only uniswapV3', async () => {
    const swapInfoTest = await loadFixture(createTestSwapInfo);
    const onlyUniswapV3Swap = constructSwap([Dex.UniswapV3], [SWAP_ONE]);
    const decodingResult = await swapInfoTest.decodeSwapInfo(onlyUniswapV3Swap);
    expect(decodingResult[1]).to.be.equal(1);

    const swapInfo = decodingResult[0][0];
    expect(swapInfo.dex).to.be.equal(Dex.UniswapV3);
    expect(swapInfo.swapRatio).to.be.equal(1 << 15);
  });

  it('split randomly between 2 Dexs', async () => {
    const swapInfoTest = await loadFixture(createTestSwapInfo);

    const firstDexRatio = Math.floor(Math.random() * SWAP_ONE);
    const secondDexRatio = SWAP_ONE - firstDexRatio;

    const dexNumber = Object.entries(Dex).length;
    const firstDex = Math.floor(Math.random() * dexNumber);
    let secondDex;

    do {
      secondDex = Math.floor(Math.random() * dexNumber);
    } while(secondDex === firstDex);

    console.log([firstDex, secondDex]);
    console.log([firstDexRatio, secondDexRatio]);

    const swap = constructSwap([firstDex, secondDex], [firstDexRatio, secondDexRatio]);
    const decodingResult = await swapInfoTest.decodeSwapInfo(swap);
    expect(decodingResult[1]).to.be.equal(2);

    const swapInfoFirst = decodingResult[0][1];
    expect(swapInfoFirst.dex).to.be.equal(firstDex);
    expect(swapInfoFirst.swapRatio).to.be.equal(firstDexRatio);

    const swapInfoSecond = decodingResult[0][0];
    expect(swapInfoSecond.dex).to.be.equal(secondDex);
    expect(swapInfoSecond.swapRatio).to.be.equal(secondDexRatio);
  });

  it('Wrong swap ratios', async () => {
    const swapInfoTest = await loadFixture(createTestSwapInfo);

    const firstDexRatio = Math.floor(Math.random() * SWAP_ONE);
    let secondDexRatio;
    do {
      secondDexRatio = Math.floor(Math.random() * SWAP_ONE);
    } while(secondDexRatio === SWAP_ONE - firstDexRatio);

    const dexNumber = Object.entries(Dex).length;
    const firstDex = Math.floor(Math.random() * dexNumber);
    let secondDex;

    do {
      secondDex = Math.floor(Math.random() * dexNumber);
    } while(secondDex === firstDex);

    console.log([firstDex, secondDex]);
    console.log([firstDexRatio, secondDexRatio]);

    const swap = constructSwap([firstDex, secondDex], [firstDexRatio, secondDexRatio]);
    expect(swapInfoTest.decodeSwapInfo(swap)).to.be.revertedWithCustomError(swapInfoTest, 'WrongSwapRatios');
  });

  it('Wrong swap ratios', async () => {
    const swapInfoTest = await loadFixture(createTestSwapInfo);

    const firstDexRatio = Math.floor(Math.random() * SWAP_ONE);
    const secondDexRatio = SWAP_ONE - firstDexRatio;

    const dexNumber = Object.entries(Dex).length;
    const firstDex = Math.floor(Math.random() * dexNumber);
    let secondDex;

    do {
      secondDex = Math.floor(Math.random() * dexNumber);
    } while(secondDex === firstDex);

    console.log([firstDex, secondDex]);
    console.log([firstDexRatio, secondDexRatio]);

    const swap = constructSwap([firstDex, secondDex], [firstDexRatio, secondDexRatio]).sub(2);
    expect(swapInfoTest.decodeSwapInfo(swap)).to.be.revertedWithCustomError(swapInfoTest, 'WrongSwapsNumber');
  });
});