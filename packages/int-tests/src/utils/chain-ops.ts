import { logger } from '../utils/logger';
import { SECS_PER_BLOCK } from './const';
import { Web3Provider } from '@ethersproject/providers';
import { MarginlyPoolContract } from '../contract-api/MarginlyPool';
import { BigNumber, ethers, ContractReceipt } from 'ethers';
import { FP96, powTaylor } from './fixed-point';

export const PositionType = {
  Uninitialized: 0,
  Lend: 1,
  Short: 2,
  Long: 3,
};

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
  const baseAccruedRatePrev = await marginlyPool.baseAccruedRate(callOpt);
  const quoteAccruedRatePrev = await marginlyPool.quoteAccruedRate(callOpt);
  const baseCollateralCoeffPrev = await marginlyPool.baseCollateralCoeff(callOpt);
  const quoteCollateralCoeffPrev = await marginlyPool.quoteCollateralCoeff(callOpt);

  const result = {
    baseDebtCoeff: baseDebtCoeffPrev,
    quoteDebtCoeff: quoteDebtCoeffPrev,
    baseAccruedRate: baseAccruedRatePrev,
    quoteAccruedRate: quoteAccruedRatePrev,
    baseCollateralCoeff: baseCollateralCoeffPrev,
    quoteCollateralCoeff: quoteCollateralCoeffPrev,
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

  if (!discountedBaseCollateralPrev.isZero()) {
    const onePlusIRshort = interestRateX96.mul(leverageShortX96).div(SECONDS_IN_YEAR_X96).add(FP96.one);
    const baseAccruedRateMul = powTaylor(onePlusIRshort, +secondsPassed);
    const baseDebtCoeffMul = powTaylor(onePlusIRshort.mul(onePlusFee).div(FP96.one), +secondsPassed);

    const baseAccruedRate = baseAccruedRatePrev.mul(baseAccruedRateMul).div(FP96.one);
    const baseCollateralCoeff = baseCollateralCoeffPrev.add(
      fp96FromRatio(
        baseAccruedRate.sub(baseAccruedRatePrev).mul(discountedBaseDebtPrev).div(FP96.one),
        discountedBaseCollateralPrev
      )
    );
    const baseDebtCoeff = baseDebtCoeffPrev.mul(baseDebtCoeffMul).div(FP96.one);

    result.baseAccruedRate = baseAccruedRate;
    result.baseCollateralCoeff = baseCollateralCoeff;
    result.baseDebtCoeff = baseDebtCoeff;
  }

  if (!discountedQuoteCollateralPrev.isZero()) {
    const onePlusIRLong = interestRateX96.mul(leverageLongX96).div(SECONDS_IN_YEAR_X96).add(FP96.one);
    const quoteAccruedRateMul = powTaylor(onePlusIRLong, +secondsPassed);
    const quoteDebtCoeffMul = powTaylor(onePlusIRLong.mul(onePlusFee).div(FP96.one), +secondsPassed);

    const quoteDebtCoeff = quoteDebtCoeffPrev.mul(quoteDebtCoeffMul).div(FP96.one);
    const quoteAccruedRate = quoteAccruedRatePrev.mul(quoteAccruedRateMul).div(FP96.one);

    const quoteCollateralCoeff = quoteCollateralCoeffPrev.add(
      fp96FromRatio(
        quoteAccruedRate.sub(quoteAccruedRatePrev).mul(discountedQuoteDebtPrev).div(FP96.one),
        discountedQuoteCollateralPrev
      )
    );

    result.quoteAccruedRate = quoteAccruedRate;
    result.quoteDebtCoeff = quoteDebtCoeff;
    result.quoteCollateralCoeff = quoteCollateralCoeff;
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
  const baseAccruedRate = await marginlyPool.baseAccruedRate();
  const quoteDebtCoeff = await marginlyPool.quoteDebtCoeff();
  const quoteAccruedRate = await marginlyPool.quoteAccruedRate();
  const quoteCollateralCoeff = await marginlyPool.quoteCollateralCoeff();
  const baseCollateralCoeff = await marginlyPool.baseCollateralCoeff();

  const expectedCoeffs = await calcAccruedRateCoeffs(marginlyPool, prevBlockNumber, marginCallHappened);

  if (!expectedCoeffs.baseAccruedRate.eq(baseAccruedRate)) {
    throw new Error(`baseAccruedRate coeff differs ${expectedCoeffs.baseAccruedRate} and ${baseAccruedRate}`);
  }
  if (!expectedCoeffs.quoteAccruedRate.eq(quoteAccruedRate)) {
    throw new Error(`quoteAccruedRate coeff differs ${expectedCoeffs.quoteAccruedRate} and ${quoteAccruedRate}`);
  }
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
}

export async function calcDebtFee(
  marginlyPool: MarginlyPoolContract,
  positionAddress: string,
  prevBlockNumber: number
) {
  const coeffs = await calcAccruedRateCoeffs(marginlyPool, prevBlockNumber);
  const positionPrev = await marginlyPool.positions(positionAddress, { blockTag: prevBlockNumber });
  const position = await marginlyPool.positions(positionAddress);

  await assertAccruedRateCoeffs(marginlyPool, prevBlockNumber);

  if (
    (positionPrev._type === PositionType.Long && position._type === PositionType.Lend) ||
    (positionPrev._type === PositionType.Long && positionPrev.discountedQuoteAmount.gt(position.discountedQuoteAmount))
  ) {
    const debtFee = divFp96(coeffs.quoteDebtCoeff, coeffs.quoteAccruedRate)
      .sub(FP96.one)
      .mul(positionPrev.discountedQuoteAmount)
      .div(FP96.one);
    return debtFee;
  }

  if (
    (positionPrev._type === PositionType.Short && position._type === PositionType.Lend) ||
    (positionPrev._type === PositionType.Short && positionPrev.discountedBaseAmount.gt(position.discountedBaseAmount))
  ) {
    const debtFee = divFp96(coeffs.baseDebtCoeff, coeffs.baseAccruedRate)
      .sub(FP96.one)
      .mul(positionPrev.discountedBaseAmount)
      .div(FP96.one);
    return debtFee;
  }

  return BigNumber.from(0);
}
