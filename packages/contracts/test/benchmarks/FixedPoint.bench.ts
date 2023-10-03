import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { convertFP96ToNumber, convertNumberToFP96, toHumanString } from '../shared/utils';

describe('Gas Benchmark - FixedPoint', () => {
  const gasBenchmarks: {
    method: string;
    time: string;
    base: number;
    exponent: number;
    result: number;
    expected: number;
    delta: number;
    gasUsed: number;
  }[] = [];

  async function deployFixedPointFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner] = await ethers.getSigners();

    const factory = await ethers.getContractFactory('FixedPointTest');
    const contract = await factory.deploy();
    await contract.deployed();

    return { contract, owner };
  }

  after(() => {
    console.table(gasBenchmarks);
  });

  it('Should pow x^y', async () => {
    const { contract, owner } = await loadFixture(deployFixedPointFixture);
    const base = 1 + (10 * 0.05) / 31557600;
    const baseFp = convertNumberToFP96(base);
    const exponents = [
      { time: 'same block', exp: 0 },
      { time: '1 second', exp: 1 },
      { time: '1 minute', exp: 60 },
      { time: '30 minutes', exp: 1800 },
      { time: '1 hour', exp: 3600 },
      { time: '2 hours', exp: 7200 },
      { time: '4 hours', exp: 14400 },
      { time: '6 hours', exp: 21600 },
      { time: '12 hours', exp: 43200 },
      { time: '1 day', exp: 93600 },
      { time: '2 days', exp: 187200 },
      { time: '5 days', exp: 432000 },
      { time: '7 days', exp: 604800 },
      { time: '1 month', exp: 2592000 },
      { time: '180 days', exp: 15552000 },
      { time: '1 year', exp: 31557600 },
      { time: '1023 secs', exp: 1023 },
      { time: '1024 secs', exp: 1024 },
      { time: '63 secs', exp: 63 },
      { time: '64 secs', exp: 64 },
    ];

    for (const { time, exp } of exponents) {
      const powTx = await contract.connect(owner).pow(baseFp, exp);
      const powReceipt = await powTx.wait();
      const currentGasUsed = powReceipt.gasUsed.toNumber();

      const result = convertFP96ToNumber(await contract.result());
      const expected = Math.pow(base, exp);

      gasBenchmarks.push({
        method: 'pow',
        time,
        base,
        exponent: exp,
        result,
        expected,
        delta: expected - result,
        gasUsed: currentGasUsed,
      });
    }
  });

  it('Should powTaylor x^y', async () => {
    const { contract, owner } = await loadFixture(deployFixedPointFixture);
    const base = 1 + (10 * 0.05) / 31557600;
    const baseFp = convertNumberToFP96(base);
    const exponents = [
      { time: 'same block', exp: 0 },
      { time: '1 second', exp: 1 },
      { time: '1 minute', exp: 60 },
      { time: '30 minutes', exp: 1800 },
      { time: '1 hour', exp: 3600 },
      { time: '2 hours', exp: 7200 },
      { time: '4 hours', exp: 14400 },
      { time: '6 hours', exp: 21600 },
      { time: '12 hours', exp: 43200 },
      { time: '1 day', exp: 93600 },
      { time: '2 days', exp: 187200 },
      { time: '5 days', exp: 432000 },
      { time: '7 days', exp: 604800 },
      { time: '1 month', exp: 2592000 },
      { time: '180 days', exp: 15552000 },
      { time: '1 year', exp: 31557600 },
      { time: '1023 secs', exp: 1023 },
      { time: '1024 secs', exp: 1024 },
      { time: '63 secs', exp: 63 },
      { time: '64 secs', exp: 64 },
    ];

    for (const { time, exp } of exponents) {
      const powTaylorTx = await contract.connect(owner).powTaylor(baseFp, exp);
      const powTaylorReceipt = await powTaylorTx.wait();
      const currentGasUsed = powTaylorReceipt.gasUsed.toNumber();

      const result = +toHumanString(await contract.result());
      const expected = Math.pow(base, exp);

      gasBenchmarks.push({
        method: 'powTaylor',
        time,
        base,
        exponent: exp,
        result,
        expected,
        delta: expected - result,
        gasUsed: currentGasUsed,
      });
    }
  });
});
