import { ethers } from 'hardhat';
import { BigNumber, Wallet, logger } from 'ethers';
import bn from 'bignumber.js';
import { MarginlyPool } from '../../typechain-types';
import { expect } from 'chai';
import { TechnicalPositionOwner } from './fixtures';

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function generateWallets(count: number): Promise<Wallet[]> {
  const wallets = [];
  for (let i = 0; i < count; i++) {
    let wallet = ethers.Wallet.createRandom();
    wallet = wallet.connect(ethers.provider);
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

export const CallType = {
  DepositBase: 0,
  DepositQuote: 1,
  WithdrawBase: 2,
  WithdrawQuote: 3,
  Short: 4,
  Long: 5,
  ClosePosition: 6,
  Reinit: 7,
  ReceivePosition: 8,
  EmergencyWithdraw:9,
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

export const WHOLE_ONE = 1e6;
export const SECONDS_IN_YEAR_X96 = BigNumber.from(365.25 * 24 * 60 * 60).mul(FP96.one);

function mulFp96(firstX96: BigNumber, secondX96: BigNumber): BigNumber {
  return firstX96.mul(secondX96).div(FP96.one);
}

function divFp96(nomX96: BigNumber, denomX96: BigNumber): BigNumber {
  return nomX96.mul(FP96.one).div(denomX96);
}

function fp96FromRatio(nom: BigNumber, denom: BigNumber): BigNumber {
  return nom.mul(FP96.one).div(denom);
}

export async function calcAccruedRateCoeffs(marginlyPool: MarginlyPool, prevBlockNumber: number) {
  const callOpt = { blockTag: prevBlockNumber };

  const params = await marginlyPool.params(callOpt);
  const systemLeverage = await marginlyPool.systemLeverage(callOpt);
  const leverageShortX96 = systemLeverage.shortX96;
  const leverageLongX96 = systemLeverage.longX96;

  const lastReinitOnPrevBlock = await marginlyPool.lastReinitTimestampSeconds(callOpt);
  const lastReinitTimestamp = await marginlyPool.lastReinitTimestampSeconds();
  const secondsPassed = lastReinitTimestamp.sub(lastReinitOnPrevBlock);
  if (+secondsPassed === 0) {
    throw new Error(`Wrong argument`);
  }

  const baseDebtCoeffPrev = await marginlyPool.baseDebtCoeff(callOpt);
  const quoteDebtCoeffPrev = await marginlyPool.quoteDebtCoeff(callOpt);
  const baseCollateralCoeffPrev = await marginlyPool.baseCollateralCoeff(callOpt);
  const quoteCollateralCoeffPrev = await marginlyPool.quoteCollateralCoeff(callOpt);
  const result = {
    baseDebtCoeff: baseDebtCoeffPrev,
    quoteDebtCoeff: quoteDebtCoeffPrev,
    baseCollateralCoeff: baseCollateralCoeffPrev,
    quoteCollateralCoeff: quoteCollateralCoeffPrev,
    discountedBaseDebtFee: BigNumber.from(0),
    discountedQuoteDebtFee: BigNumber.from(0),
  };

  const discountedBaseDebtPrev = await marginlyPool.discountedBaseDebt(callOpt);
  const discountedQuoteDebtPrev = await marginlyPool.discountedQuoteDebt(callOpt);
  const discountedBaseCollateralPrev = await marginlyPool.discountedBaseCollateral(callOpt);
  const discountedQuoteCollateralPrev = await marginlyPool.discountedQuoteCollateral(callOpt);

  const interestRateX96 = BigNumber.from(params.interestRate).mul(FP96.one).div(WHOLE_ONE);
  const feeX96 = BigNumber.from(params.fee).mul(FP96.one).div(WHOLE_ONE);

  const onePlusFee = feeX96.mul(FP96.one).div(SECONDS_IN_YEAR_X96).add(FP96.one);

  const feeDt = powTaylor(onePlusFee, +secondsPassed);

  if (!discountedBaseCollateralPrev.isZero()) {
    const onePlusIRshort = interestRateX96.mul(leverageShortX96).div(SECONDS_IN_YEAR_X96).add(FP96.one);
    const accruedRateDt = powTaylor(onePlusIRshort, +secondsPassed);
    const baseDebtCoeffMul = powTaylor(onePlusIRshort.mul(onePlusFee).div(FP96.one), +secondsPassed);

    const baseCollateralCoeff = baseCollateralCoeffPrev.add(
      fp96FromRatio(
        accruedRateDt.sub(FP96.one).mul(baseDebtCoeffPrev).div(FP96.one).mul(discountedBaseDebtPrev).div(FP96.one),
        discountedBaseCollateralPrev
      )
    );
    const baseDebtCoeff = baseDebtCoeffPrev.mul(baseDebtCoeffMul).div(FP96.one);

    const realBaseDebtFee = accruedRateDt
      .mul(feeDt.sub(FP96.one))
      .div(FP96.one)
      .mul(baseDebtCoeffPrev)
      .div(FP96.one)
      .mul(discountedBaseDebtPrev)
      .div(FP96.one);

    result.discountedBaseDebtFee = realBaseDebtFee.mul(FP96.one).div(baseCollateralCoeff);
    result.baseCollateralCoeff = baseCollateralCoeff;
    result.baseDebtCoeff = baseDebtCoeff;
  }

  if (!discountedQuoteCollateralPrev.isZero()) {
    const onePlusIRLong = interestRateX96.mul(leverageLongX96).div(SECONDS_IN_YEAR_X96).add(FP96.one);
    const accruedRateDt = powTaylor(onePlusIRLong, +secondsPassed);
    const quoteDebtCoeffMul = powTaylor(onePlusIRLong.mul(onePlusFee).div(FP96.one), +secondsPassed);

    const quoteDebtCoeff = quoteDebtCoeffPrev.mul(quoteDebtCoeffMul).div(FP96.one);

    const quoteCollateralCoeff = quoteCollateralCoeffPrev.add(
      fp96FromRatio(
        accruedRateDt.sub(FP96.one).mul(quoteDebtCoeffPrev).div(FP96.one).mul(discountedQuoteDebtPrev).div(FP96.one),
        discountedQuoteCollateralPrev
      )
    );

    const realQuoteDebtFee = accruedRateDt
      .mul(feeDt.sub(FP96.one))
      .div(FP96.one)
      .mul(quoteDebtCoeffPrev)
      .div(FP96.one)
      .mul(discountedQuoteDebtPrev)
      .div(FP96.one);

    result.discountedQuoteDebtFee = realQuoteDebtFee.mul(FP96.one).div(quoteCollateralCoeff);
    result.quoteDebtCoeff = quoteDebtCoeff;
    result.quoteCollateralCoeff = quoteCollateralCoeff;
  }

  return result;
}

export async function assertAccruedRateCoeffs(marginlyPool: MarginlyPool, prevBlockNumber: number) {
  const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
  const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
  const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
  const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();
  const techPosition = await marginlyPool.positions(TechnicalPositionOwner);

  const overrides = { blockTag: prevBlockNumber };
  const techPositionPrev = await marginlyPool.positions(TechnicalPositionOwner, overrides);
  const expectedCoeffs = await calcAccruedRateCoeffs(marginlyPool, prevBlockNumber);

  expect(expectedCoeffs.baseDebtCoeff).to.be.eq(baseDebtCoeff);
  expect(expectedCoeffs.quoteDebtCoeff).to.be.eq(quoteDebtCoeff);
  expect(expectedCoeffs.quoteCollateralCoeff).to.be.eq(quoteCollateralCoeff);
  expect(expectedCoeffs.baseCollateralCoeff).to.be.eq(baseCollateralCoeff);
  expect(techPositionPrev.discountedBaseAmount.add(expectedCoeffs.discountedBaseDebtFee)).to.be.eq(
    techPosition.discountedBaseAmount
  );
  expect(techPositionPrev.discountedQuoteAmount.add(expectedCoeffs.discountedQuoteDebtFee)).to.be.eq(
    techPosition.discountedQuoteAmount
  );
}
