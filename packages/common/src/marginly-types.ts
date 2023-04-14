import { BigNumber } from 'ethers';

export type MarginlyPoolParameters = {
  interestRate: BigNumber;
  maxLeverage: BigNumber;
  recoveryMaxLeverage: BigNumber;
  swapFee: BigNumber;
  priceSecondsAgo: BigNumber;
  positionSlippage: BigNumber;
  mcSlippage: BigNumber;
  positionMinAmount: BigNumber;
  baseLimit: BigNumber;
  quoteLimit: BigNumber;
};

export const PositionType = {
  Uninitialized: 0,
  Lend: 1,
  Short: 2,
  Long: 3,
};

export type Position = {
  _type: number;
  discountedQuoteAmount: BigNumber;
  discountedBaseAmount: BigNumber;
};

export const MarginlyMode = {
  Regular: 0,
  Recovery: 1,
  ShortEmergency: 2,
  LongEmergency: 3,
};
