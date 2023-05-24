import { BigNumber } from 'ethers';
import { Wallet, Provider} from 'zksync-web3';
import bn from 'bignumber.js';

export async function generateWallets(count: number): Promise<Wallet[]> {
  const wallets = [];
  for (let i = 0; i < count; i++) {
    let wallet = Wallet.createRandom();
    wallet = wallet.connect(Provider.getDefaultProvider());
    wallets.push(wallet);
  }

  return wallets;
}

export const PositionType = {
  Uninitialized: 0,
  Lend: 1,
  Short: 2,
  Long: 3,
};

export const MarginlyPoolMode = {
  Regular: 0,
  ShortEmergency: 1,
  LongEmergency: 2,
};

export const FP96 = {
  Q96: 2 ** 96,
  one: BigInt(2 ** 96),
};

export const FP48 = {
  Q48: BigInt(2 ** 48),
};

export function convertNumberToFP96(num: number): { inner: bigint } {
  return { inner: BigInt(num * FP96.Q96) };
}
export function convertFP96ToNumber(fp: BigNumber): number {
  const tmp = fp.div(2 ** 48);
  return tmp.toNumber() / 2 ** 48;
}

export function pow(self: BigNumber, exponent: number): BigNumber {
  let result = BigNumber.from(FP96.one);
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
  if (x >= BigNumber.from(FP96.one)) {
    throw new Error(`x can't be greater than FP.one, series diverges`);
  }

  let resultX96 = BigNumber.from(FP96.one);
  let multiplier: BigNumber;
  let term = BigNumber.from(FP96.one);

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

export function calcLongSortKey(initialPrice: BigNumber, quoteAmount: BigNumber, baseAmount: BigNumber): BigNumber {
  const collateral = initialPrice.mul(baseAmount).div(FP96.one);
  const debt = quoteAmount;

  return debt.mul(FP48.Q48).div(collateral);
}

export function calcShortSortKey(initialPrice: BigNumber, quoteAmount: BigNumber, baseAmount: BigNumber): BigNumber {
  const collateral = quoteAmount;
  const debt = initialPrice.mul(baseAmount).div(FP96.one);

  return debt.mul(FP48.Q48).div(collateral);
}

export function calcLeverageShort(
  basePrice: BigNumber,
  quoteCollateralCoeff: BigNumber,
  baseDebtCoeff: BigNumber,
  quoteAmount: BigNumber,
  baseAmount: BigNumber
) {
  const collateral = quoteCollateralCoeff.mul(quoteAmount).div(FP96.one).mul(FP96.one);
  const debt = baseDebtCoeff.mul(basePrice).div(FP96.one).mul(baseAmount).div(FP96.one).mul(FP96.one);

  return collateral.mul(FP96.one).div(collateral.sub(debt));
}

export function calcLeverageLong(
  basePrice: BigNumber,
  quoteDebtCoeff: BigNumber,
  baseCollateralCoeff: BigNumber,
  quoteAmount: BigNumber,
  baseAmount: BigNumber
) {
  const collateral = baseCollateralCoeff.mul(basePrice).div(FP96.one).mul(baseAmount).div(FP96.one).mul(FP96.one);
  const debt = quoteDebtCoeff.mul(quoteAmount).div(FP96.one).mul(FP96.one);

  return collateral.mul(FP96.one).div(collateral.sub(debt));
}
