import { logger } from '../utils/logger';
import { SECS_PER_BLOCK } from './const';
import { Web3Provider } from '@ethersproject/providers';
import { MarginlyPoolContract } from '../contract-api/MarginlyPool';
import { BigNumber, ethers, ContractReceipt } from 'ethers';
import { FP96, powTaylor } from './fixed-point';
import { TechnicalPositionOwner } from '../suites';
import { defaultAbiCoder } from 'ethers/lib/utils';

export const PositionType = {
  Uninitialized: 0,
  Lend: 1,
  Short: 2,
  Long: 3,
};

export const Dex = {
  UniswapV3: 0,
  ApeSwap: 1,
  Balancer: 2,
  Camelot: 3,
  KyberSwap: 4,
  QuickSwap: 5,
  SushiSwap: 6,
  TraderJoe: 7,
  Woofi: 8,
};

export function uniswapV3Swapdata() {
  return defaultAbiCoder.encode(['uint'], [Dex.UniswapV3]);
}

export async function waitBlocks(blocks: number): Promise<void> {
  logger.info(`Waiting for ${blocks} blocks`);
  return await new Promise((rs) => setTimeout(rs, blocks * SECS_PER_BLOCK * 1000.0));
}

export class Web3ProviderDecorator {
  readonly provider: Web3Provider;

  constructor(provider: Web3Provider) {
    this.provider = provider;
  }

  mineAtTimestamp(timestampSeconds: number): Promise<any> {
    return this.provider.send('evm_mine', [timestampSeconds]);
  }

  async getLastBlockTimestamp(): Promise<number> {
    return (await this.provider.getBlock(this.provider._lastBlockNumber)).timestamp;
  }
}

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
  EmergencyWithdraw: 9,
};

export type SwapEvent = {
  amount0: BigNumber;
  amount1: BigNumber;
  sqrtPriceX96: BigNumber;
  liquidity: BigNumber;
  tick: number;
};

export function decodeSwapEvent(txReceipt: ContractReceipt, uniswapAddress: string): SwapEvent {
  const swapEvent = txReceipt.events!.find((e) => e.address == uniswapAddress);
  const swapEventTypes = ['int256', 'int256', 'uint160', 'uint128', 'int24'];
  const result = ethers.utils.defaultAbiCoder.decode(swapEventTypes, swapEvent!.data);

  return {
    amount0: BigNumber.from(result[0]),
    amount1: BigNumber.from(result[1]),
    sqrtPriceX96: BigNumber.from(result[2]),
    liquidity: BigNumber.from(result[3]),
    tick: result[4],
  };
}

export async function getLongSortKeyX48(
  marginlyPool: MarginlyPoolContract,
  accountAddress: string
): Promise<BigNumber> {
  const position = await marginlyPool.positions(accountAddress);
  const index = BigNumber.from(position.heapPosition).sub(1);
  logger.debug(`  heap position is ${position.heapPosition}`);
  const [, leverage] = await marginlyPool.getLongHeapPosition(index);
  return BigNumber.from(leverage.key);
}

export async function getShortSortKeyX48(
  marginlyPool: MarginlyPoolContract,
  accountAddress: string
): Promise<BigNumber> {
  const position = await marginlyPool.positions(accountAddress);
  const index = BigNumber.from(position.heapPosition).sub(1);
  logger.debug(`  heap position is ${position.heapPosition}`);
  const [, leverage] = await marginlyPool.getShortHeapPosition(index);
  return BigNumber.from(leverage.key);
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

/// Same as accrueInterest in smart contract
export async function calcAccruedRateCoeffs(
  marginlyPool: MarginlyPoolContract,
  prevBlockNumber: number,
  marginCallHappened = false
) {
  const callOpt = { blockTag: prevBlockNumber };

  const params = await marginlyPool.params(callOpt);
  const systemLeverage = await marginlyPool.systemLeverage(callOpt);
  const leverageShortX96 = systemLeverage.shortX96;
  const leverageLongX96 = systemLeverage.longX96;

  const lastReinitOnPrevBlock = await marginlyPool.lastReinitTimestampSeconds(callOpt);
  const lastReinitTimestamp = await marginlyPool.lastReinitTimestampSeconds();
  const secondsPassed = BigNumber.from(lastReinitTimestamp).sub(lastReinitOnPrevBlock);

  const baseDebtCoeffPrev = await marginlyPool.baseDebtCoeff(callOpt);
  const quoteDebtCoeffPrev = await marginlyPool.quoteDebtCoeff(callOpt);
  const baseCollateralCoeffPrev = await marginlyPool.baseCollateralCoeff(callOpt);
  const quoteCollateralCoeffPrev = await marginlyPool.quoteCollateralCoeff(callOpt);
  const baseDelevCoeffPrev = await marginlyPool.baseDelevCoeff(callOpt);
  const quoteDelevCoeffPrev = await marginlyPool.quoteDelevCoeff(callOpt);

  const result = {
    baseDebtCoeff: baseDebtCoeffPrev,
    quoteDebtCoeff: quoteDebtCoeffPrev,
    baseCollateralCoeff: baseCollateralCoeffPrev,
    quoteCollateralCoeff: quoteCollateralCoeffPrev,
    baseDelevCoeff: baseDelevCoeffPrev,
    quoteDelevCoeff: quoteDelevCoeffPrev,
    discountedBaseDebtFee: BigNumber.from(0),
    discountedQuoteDebtFee: BigNumber.from(0),
  };

  if (+secondsPassed === 0) {
    return result;
  }

  const discountedBaseDebtPrev = await marginlyPool.discountedBaseDebt(callOpt);
  const discountedQuoteDebtPrev = await marginlyPool.discountedQuoteDebt(callOpt);
  const discountedBaseCollateralPrev = await marginlyPool.discountedBaseCollateral(callOpt);
  const discountedQuoteCollateralPrev = await marginlyPool.discountedQuoteCollateral(callOpt);

  const interestRateX96 = BigNumber.from(params.interestRate).mul(FP96.one).div(WHOLE_ONE);
  const feeX96 = BigNumber.from(params.fee).mul(FP96.one).div(WHOLE_ONE);

  const onePlusFee = feeX96.mul(FP96.one).div(SECONDS_IN_YEAR_X96).add(FP96.one);
  const feeDt = powTaylor(onePlusFee, +secondsPassed);

  if (!discountedBaseCollateralPrev.isZero()) {
    const realBaseDebtPrev = baseDebtCoeffPrev.mul(discountedBaseDebtPrev).div(FP96.one);
    const onePlusIRshort = interestRateX96.mul(leverageShortX96).div(SECONDS_IN_YEAR_X96).add(FP96.one);
    const accruedRateDt = powTaylor(onePlusIRshort, +secondsPassed);
    const realBaseCollateral = baseCollateralCoeffPrev.mul(discountedBaseCollateralPrev).div(FP96.one);
    const factor = FP96.one.add(
      fp96FromRatio(accruedRateDt.sub(FP96.one).mul(realBaseDebtPrev).div(FP96.one), realBaseCollateral)
    );
    const baseCollateralCoeff = baseCollateralCoeffPrev.mul(factor).div(FP96.one);
    const baseDelevCoeff = baseDelevCoeffPrev.mul(factor);
    const baseDebtCoeff = baseDebtCoeffPrev.mul(accruedRateDt).div(FP96.one).mul(feeDt).div(FP96.one);

    const realBaseDebtFee = accruedRateDt.mul(feeDt.sub(FP96.one)).div(FP96.one).mul(realBaseDebtPrev).div(FP96.one);

    result.discountedBaseDebtFee = realBaseDebtFee.mul(FP96.one).div(baseCollateralCoeff);
    result.baseCollateralCoeff = baseCollateralCoeff;
    result.baseDebtCoeff = baseDebtCoeff;
    result.baseDelevCoeff = baseDelevCoeff;
  }

  if (!discountedQuoteCollateralPrev.isZero()) {
    const realQuoteDebtPrev = quoteDebtCoeffPrev.mul(discountedQuoteDebtPrev).div(FP96.one);
    const onePlusIRLong = interestRateX96.mul(leverageLongX96).div(SECONDS_IN_YEAR_X96).add(FP96.one);
    const accruedRateDt = powTaylor(onePlusIRLong, +secondsPassed);
    const quoteDebtCoeff = quoteDebtCoeffPrev.mul(accruedRateDt).div(FP96.one).mul(feeDt).div(FP96.one);
    const realQuoteCollateral = quoteCollateralCoeffPrev.mul(discountedQuoteCollateralPrev).div(FP96.one);
    const factor = FP96.one.add(
      fp96FromRatio(accruedRateDt.sub(FP96.one).mul(realQuoteDebtPrev).div(FP96.one), realQuoteCollateral)
    );
    const quoteCollateralCoeff = quoteCollateralCoeffPrev.mul(factor).div(FP96.one);
    const quoteDelevCoeff = quoteDelevCoeffPrev.mul(factor).div(FP96.one);

    const realQuoteDebtFee = accruedRateDt.mul(feeDt.sub(FP96.one)).div(FP96.one).mul(realQuoteDebtPrev).div(FP96.one);

    result.discountedQuoteDebtFee = realQuoteDebtFee.mul(FP96.one).div(quoteCollateralCoeff);
    result.quoteDebtCoeff = quoteDebtCoeff;
    result.quoteCollateralCoeff = quoteCollateralCoeff;
    result.quoteDelevCoeff = quoteDelevCoeff;
  }

  //skip calculation of collateralCoeff on MC
  if (marginCallHappened) {
    result.quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
    result.baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();
  }

  return result;
}

export async function assertAccruedRateCoeffs(
  marginlyPool: MarginlyPoolContract,
  prevBlockNumber: number,
  marginCallHappened = false
) {
  const baseDebtCoeff = await marginlyPool.baseDebtCoeff();
  const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
  const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
  const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();
  const quoteDelevCoeff = await marginlyPool.quoteDelevCoeff();
  const baseDelevCoeff = await marginlyPool.baseDelevCoeff();

  const technicalPosition = await marginlyPool.positions(TechnicalPositionOwner);
  const technicalPositionPrev = await marginlyPool.positions(TechnicalPositionOwner, { blockTag: prevBlockNumber });

  const expectedCoeffs = await calcAccruedRateCoeffs(marginlyPool, prevBlockNumber, marginCallHappened);

  if (!expectedCoeffs.baseDebtCoeff.eq(baseDebtCoeff)) {
    throw new Error(`baseDebtCoeff coeff differs ${expectedCoeffs.baseDebtCoeff} and ${baseDebtCoeff}`);
  }
  if (!expectedCoeffs.quoteDebtCoeff.eq(quoteDebtCoeff)) {
    throw new Error(`quoteDebtCoeff coeff differs ${expectedCoeffs.quoteDebtCoeff} and ${quoteDebtCoeff}`);
  }
  if (!expectedCoeffs.quoteCollateralCoeff.eq(quoteCollateralCoeff)) {
    throw new Error(
      `quoteCollateralCoeff coeff differs ${expectedCoeffs.quoteCollateralCoeff} and ${quoteCollateralCoeff}`
    );
  }
  if (!expectedCoeffs.baseCollateralCoeff.eq(baseCollateralCoeff)) {
    throw new Error(
      `baseCollateralCoeff coeff differs ${expectedCoeffs.baseCollateralCoeff} and ${baseCollateralCoeff}`
    );
  }

  if (!expectedCoeffs.quoteDelevCoeff.eq(quoteDelevCoeff)) {
    throw new Error(`quoteDelevCoeff coeff differs ${expectedCoeffs.quoteDelevCoeff} and ${quoteDelevCoeff}`);
  }
  if (!expectedCoeffs.baseDelevCoeff.eq(baseDelevCoeff)) {
    throw new Error(`baseDelevCoeff coeff differs ${expectedCoeffs.baseDelevCoeff} and ${baseDelevCoeff}`);
  }

  if (
    !technicalPosition.discountedBaseAmount.eq(
      technicalPositionPrev.discountedBaseAmount.add(expectedCoeffs.discountedBaseDebtFee)
    )
  ) {
    throw new Error(
      `technicalPosition.discountedBaseAmount ${technicalPosition.discountedBaseAmount} doesn't equal prev value ${technicalPositionPrev.discountedBaseAmount} plus fee ${expectedCoeffs.discountedBaseDebtFee}`
    );
  }

  if (
    !technicalPosition.discountedQuoteAmount.eq(
      technicalPositionPrev.discountedQuoteAmount.add(expectedCoeffs.discountedQuoteDebtFee)
    )
  ) {
    throw new Error(
      `technicalPosition.discountedQuoteAmount ${technicalPosition.discountedQuoteAmount} doesn't equal prev value ${technicalPositionPrev.discountedQuoteAmount} plus fee ${expectedCoeffs.discountedQuoteDebtFee}`
    );
  }

  return expectedCoeffs;
}
