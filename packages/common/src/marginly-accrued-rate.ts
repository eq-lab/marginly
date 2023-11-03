import { BigNumber } from 'ethers';
import { Fp96One, SECONDS_IN_YEAR_X96, WHOLE_ONE } from './types';
import { fp96FromRatio, powTaylor } from './math';

export function calcAccruedRateContext(args: { interestRate: BigNumber; fee: BigNumber; secondsPassed: number }): {
  interestRateX96: BigNumber;
  feeDt: BigNumber;
} {
  const interestRateX96 = BigNumber.from(args.interestRate).mul(Fp96One).div(WHOLE_ONE);
  const feeX96 = BigNumber.from(args.fee).mul(Fp96One).div(WHOLE_ONE);
  const onePlusFee = feeX96.mul(Fp96One).div(SECONDS_IN_YEAR_X96).add(Fp96One);
  const feeDt = powTaylor(onePlusFee, args.secondsPassed);

  return {
    interestRateX96,
    feeDt,
  };
}

export function calcBaseCoeffs(args: {
  baseDebtCoeffX96: BigNumber;
  baseCollateralCoeffX96: BigNumber;
  baseDelevCoeffX96: BigNumber;
  discountedBaseDebt: BigNumber;
  discountedBaseCollateral: BigNumber;
  discountedQuoteDebt: BigNumber;
  interestRateX96: BigNumber;
  systemLeverageShortX96: BigNumber;
  secondsPassed: number;
  feeDt: BigNumber;
}): {
  baseCollateralCoeffX96: BigNumber;
  baseDelevCoeffX96: BigNumber;
  baseDebtCoeffX96: BigNumber;
} {
  const realBaseDebtPrev = args.baseDebtCoeffX96.mul(args.discountedBaseDebt).div(Fp96One);
  const onePlusIRshort = args.interestRateX96.mul(args.systemLeverageShortX96).div(SECONDS_IN_YEAR_X96).add(Fp96One);
  const accruedRateDt = powTaylor(onePlusIRshort, args.secondsPassed);
  const baseDebtCoeffMul = accruedRateDt.mul(args.feeDt).div(Fp96One);

  const realBaseCollateral = args.baseCollateralCoeffX96
    .mul(args.discountedBaseCollateral)
    .div(Fp96One)
    .sub(args.baseDelevCoeffX96.mul(args.discountedQuoteDebt).div(Fp96One));

  const factor = Fp96One.add(
    fp96FromRatio(accruedRateDt.sub(Fp96One).mul(realBaseDebtPrev).div(Fp96One), realBaseCollateral)
  );

  return {
    baseCollateralCoeffX96: args.baseCollateralCoeffX96.mul(factor).div(Fp96One),
    baseDelevCoeffX96: args.baseDelevCoeffX96.mul(factor).div(Fp96One),
    baseDebtCoeffX96: args.baseDebtCoeffX96.mul(baseDebtCoeffMul).div(Fp96One),
  };
}

export function calcQuoteCoeffs(args: {
  quoteCollateralCoeffX96: BigNumber;
  quoteDebtCoeffX96: BigNumber;
  quoteDelevCoeffX96: BigNumber;
  discountedQuoteCollateral: BigNumber;
  discountedQuoteDebt: BigNumber;
  discountedBaseDebt: BigNumber;
  interestRateX96: BigNumber;
  systemLevarageLongX96: BigNumber;
  secondsPassed: number;
  feeDt: BigNumber;
}): {
  quoteCollateralCoeffX96: BigNumber;
  quoteDelevCoeffX96: BigNumber;
  quoteDebtCoeffX96: BigNumber;
} {
  const realQuoteDebtPrev = args.quoteDebtCoeffX96.mul(args.discountedQuoteDebt).div(Fp96One);
  const onePlusIRLong = args.interestRateX96.mul(args.systemLevarageLongX96).div(SECONDS_IN_YEAR_X96).add(Fp96One);
  const accruedRateDt = powTaylor(onePlusIRLong, args.secondsPassed);
  const quoteDebtCoeffMul = accruedRateDt.mul(args.feeDt).div(Fp96One);

  const realQuoteCollateral = args.quoteCollateralCoeffX96
    .mul(args.discountedQuoteCollateral)
    .div(Fp96One)
    .sub(args.quoteDelevCoeffX96.mul(args.discountedBaseDebt).div(Fp96One));

  const factor = Fp96One.add(
    fp96FromRatio(accruedRateDt.sub(Fp96One).mul(realQuoteDebtPrev).div(Fp96One), realQuoteCollateral)
  );

  return {
    quoteCollateralCoeffX96: args.quoteCollateralCoeffX96.mul(factor).div(Fp96One),
    quoteDelevCoeffX96: args.quoteDelevCoeffX96.mul(factor).div(Fp96One),
    quoteDebtCoeffX96: args.quoteDebtCoeffX96.mul(quoteDebtCoeffMul).div(Fp96One),
  };
}
