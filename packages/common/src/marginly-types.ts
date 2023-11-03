import { BigNumber } from 'ethers';

export type MarginlyPoolParameters = {
  maxLeverage: BigNumber;
  priceSecondsAgo: BigNumber;
  priceSecondsAgoMC: BigNumber;
  interestRate: BigNumber;
  fee: BigNumber;
  swapFee: BigNumber;
  mcSlippage: BigNumber;
  positionMinAmount: BigNumber;
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
  ShortEmergency: 1,
  LongEmergency: 2,
};

export type HeapNode = { account: string; key: BigNumber };
