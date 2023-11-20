import { BigNumber } from 'ethers';
import { Fp96One } from './types';

export const x96FracSize = 96n;

export const x128FracSize = 128n;

interface OrdinaryNumberParts {
  type: 'ordinary';
  fractionX52: bigint;
  sign: bigint;
  exponent: bigint;
}

interface ZeroNumberParts {
  type: 'zero';
  sign: bigint;
}

type NumberParts = OrdinaryNumberParts | ZeroNumberParts;

function isZeroNumberParts(numberParts: NumberParts): numberParts is ZeroNumberParts {
  return numberParts.type === 'zero';
}

function isOrdinaryNumberParts(numberParts: NumberParts): numberParts is OrdinaryNumberParts {
  return numberParts.type === 'ordinary';
}

function partsToNumber(parts: NumberParts): number {
  if (isZeroNumberParts(parts)) {
    return parts.sign > 0 ? +0 : -0;
  } else if (isOrdinaryNumberParts(parts)) {
    const { fractionX52, sign, exponent } = parts;

    if (fractionX52 >= 1n << 53n) {
      throw new Error('Fraction is too large');
    }

    if (fractionX52 < 1n << 52n) {
      throw new Error('Fraction is too low');
    }

    if (exponent < -1022n) {
      throw new Error('Exponent is too low');
    }

    if (exponent > 1023) {
      throw new Error('Exponent is too large');
    }

    const fractionMask = (1n << 52n) - 1n;
    let packedParts = fractionX52 & fractionMask;
    packedParts |= (exponent + 1023n) << 52n;
    packedParts |= (sign >= 0n ? 0n : 1n) << 63n;

    const float = new Float64Array(1);
    const bytes = new Uint8Array(float.buffer);

    for (let i = 0; i < bytes.length; i++) {
      const byte = packedParts % 0x100n;
      bytes[i] = Number(byte);

      packedParts /= 0x100n;
    }

    return float[0];
  } else {
    throw new Error('Unknown number parts type');
  }
}

function numberToParts(num: number): NumberParts {
  if (!Number.isFinite(num)) {
    throw new Error('Number must be finite');
  }

  const float = new Float64Array(1);
  float[0] = num;

  const bytes = new Uint8Array(float.buffer);

  let acc = 0n;

  for (let i = bytes.length - 1; i >= 0; i--) {
    const byte = bytes[i];
    acc *= 0x100n;
    acc += BigInt(byte);
  }

  const sign = ((1n << 63n) & acc) !== 0n ? -1n : 1n;

  if ((acc & ((1n << 63n) - 1n)) === 0n) {
    return {
      type: 'zero',
      sign,
    };
  } else {
    const fractionMask = (1n << 52n) - 1n;

    const fractionX52 = (1n << 52n) | (acc & fractionMask);
    const exponentMask = ((1n << 11n) - 1n) << 52n;
    const exponentOffset = (acc & exponentMask) >> 52n;
    const exponent = exponentOffset - 1023n;

    return {
      type: 'ordinary',
      fractionX52,
      sign,
      exponent,
    };
  }
}

export function numberToX(fracSize: bigint, num: number): bigint {
  const parts = numberToParts(num);

  if (isZeroNumberParts(parts)) {
    return 0n;
  } else if (isOrdinaryNumberParts(parts)) {
    const { sign, exponent, fractionX52 } = parts;

    if (sign < 0) {
      throw new Error('Number must be non-negative');
    }

    const offset = fracSize - 52n + exponent;

    if (offset > 256n - 53n) {
      throw new Error(`Number is too big to fit into uint256`);
    }

    return offset > 0 ? fractionX52 << offset : fractionX52 >> -offset;
  } else {
    throw new Error('Unknown number parts type');
  }
}

export function xToNumber(fracSize: bigint, xNum: bigint): number {
  if (xNum < 0) {
    throw new Error('Number must be non-negative');
  } else if (xNum === 0n) {
    return 0;
  } else {
    let msbNum = -1n;

    let curr = xNum;
    while (curr != 0n) {
      curr >>= 1n;
      msbNum++;
    }

    const shift = 52n - msbNum;

    const fractionX52 = shift < 0 ? xNum >> -shift : xNum << shift;
    const exponent = msbNum - 96n;
    const parts: OrdinaryNumberParts = {
      type: 'ordinary',
      fractionX52,
      exponent,
      sign: 1n,
    };
    return partsToNumber(parts);
  }
}

export function sqrtPriceX96toPrice(sqrtPriceX96: bigint, tokenDecimals0: number, tokenDecimals1: number): number {
  const sqrtPrice = xToNumber(x96FracSize, sqrtPriceX96);
  return sqrtPrice * sqrtPrice * 10 ** (tokenDecimals0 - tokenDecimals1);
}

export function priceToSqrtPriceX96(price: number, tokenDecimals0: number, tokenDecimals1: number): bigint {
  const sqrtPrice = Math.sqrt(price * 10 ** (tokenDecimals1 - tokenDecimals0));
  return numberToX(x96FracSize, sqrtPrice);
}

export function twapFromTickCumulatives(
  [tickCumulative0, tickCumulative1]: [bigint, bigint],
  [secondsAgo0, secondsAgo1]: [bigint, bigint],
  tokenDecimals0: number,
  tokenDecimals1: number
): number {
  const tickCumulativeDelta = Number(tickCumulative1 - tickCumulative0);
  const secondsAgoDelta = Number(secondsAgo0 - secondsAgo1);
  return Math.pow(1.0001, tickCumulativeDelta / secondsAgoDelta) * 10 ** (tokenDecimals0 - tokenDecimals1);
}

export function priceToPriceFp(price: number, priceDecimals: number, token0Decimals: number, token1Decimals: number) {
  const deltaDecimals = BigInt(token1Decimals - token0Decimals);

  const priceFp = numberToFp(priceDecimals, price);

  if (deltaDecimals >= 0n) {
    return priceFp * 10n ** deltaDecimals;
  } else {
    return priceFp / 10n ** -deltaDecimals;
  }
}

export function priceToPriceFp18(price: number, token0Decimals: number, token1Decimals: number): bigint {
  return priceToPriceFp(price, 18, token0Decimals, token1Decimals);
}

export function priceToPriceFp27(price: number, token0Decimals: number, token1Decimals: number): bigint {
  return priceToPriceFp(price, 27, token0Decimals, token1Decimals);
}

export function hexStringToBigInt(hexString: string) {
  const hexStringRegex = /^0x([0-9a-f]{2})+$/i;
  if (hexString.match(hexStringRegex) === null) {
    throw new Error('Invalid hex string');
  }

  let acc = 0n;

  for (let i = 2; i < hexString.length; i += 2) {
    const byteHexString = hexString.substring(i, i + 2);

    acc *= 0x100n;
    acc += BigInt(parseInt(byteHexString, 16));
  }

  return acc;
}

export function sortUniswapPoolTokens<T>(
  [tokenAAddress, tokenBAddress]: [`0x${string}`, `0x${string}`],
  [tokenA, tokenB]: [T, T]
): [T, T] {
  const tokenABigInt = hexStringToBigInt(tokenAAddress);
  const tokenBBigInt = hexStringToBigInt(tokenBAddress);

  if (tokenABigInt > tokenBBigInt) {
    return [tokenB, tokenA];
  } else {
    return [tokenA, tokenB];
  }
}

export function numberToFp(decimals: number, num: number): bigint {
  return BigInt(Math.trunc(num * 10 ** decimals));
}

export function fpToNumber(decimals: number, fpNum: bigint): number {
  return Number(fpNum) / 10 ** decimals;
}

export function powTaylor(self: BigNumber, exponent: number): BigNumber {
  const x = self.sub(Fp96One);
  if (x >= BigNumber.from(Fp96One)) {
    throw new Error(`x can't be greater than FP.one, series diverges`);
  }

  let resultX96 = BigNumber.from(Fp96One);
  let multiplier: BigNumber;
  let term = BigNumber.from(Fp96One);

  const steps = exponent < 3 ? exponent : 3;
  for (let i = 0; i != steps; ++i) {
    multiplier = BigNumber.from(exponent - i)
      .mul(x)
      .div(BigNumber.from(i + 1));
    term = term.mul(multiplier).div(Fp96One);
    resultX96 = resultX96.add(term);
  }

  return resultX96;
}

export function fp96FromRatio(nom: BigNumber, denom: BigNumber): BigNumber {
  return nom.mul(Fp96One).div(denom);
}
