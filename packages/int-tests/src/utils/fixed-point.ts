import { BigNumber } from 'ethers';
import bn from 'bignumber.js';

export const FP96 = {
  one: BigNumber.from(2n ** 96n),
};

export const FP48 = {
  one: BigNumber.from(2n ** 48n),
};

// 365.25 * 24 * 60 * 60 * 2 ** 96
export const secondsInYearX96 = BigNumber.from('2500250661360148260042022567123353600');

export function pow(self: BigNumber, exponent: number): BigNumber {
  let result = FP96.one;
  while (exponent > 0) {
    if ((exponent & 1) == 1) {
      result = result.mul(self).div(FP96.one);
    }
    self = self.mul(self).div(FP96.one);
    exponent = exponent >> 1;
  }

  return result;
}

export function powTaylor(self: BigNumber, exponent: number): BigNumber {
  const x = self.sub(FP96.one);
  if (x >= FP96.one) {
    throw new Error(`x can't be greater than FP.one, series diverges`);
  }

  let resultX96 = FP96.one;
  let multiplier: BigNumber;
  let term = FP96.one;

  const steps = exponent < 3 ? exponent : 3;
  for (let i = 0; i != steps; ++i) {
    multiplier = BigNumber.from(exponent - i)
      .mul(x)
      .div(BigNumber.from(i + 1));
    term = term.mul(multiplier).div(FP96.one);
    resultX96 = resultX96.add(term);
  }

  return resultX96;
}

export function toHumanString(fp96Value: BigNumber): string {
  return bn(fp96Value.toString()).div(FP96.one.toString()).toString();
}

export function fp48ToHumanString(fp10Value: BigNumber): string {
  return bn(fp10Value.toString()).div(FP48.one.toString()).toString();
}
