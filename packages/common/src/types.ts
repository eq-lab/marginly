import { BigNumber } from '@ethersproject/bignumber';
import * as ethers from 'ethers';

export class EthAddress {
  private static zeroRegex = /^0x0{40}$/;

  private readonly address: string;

  private constructor(address: string) {
    this.address = address;
  }

  public static parse(str: string): EthAddress {
    return new EthAddress(ethers.utils.getAddress(str));
  }

  public toString(): string {
    return this.address;
  }

  public isZero(): boolean {
    return this.address.match(EthAddress.zeroRegex) !== null;
  }

  public toBigNumber(): BigNumber {
    return BigNumber.from(this.address);
  }

  public compare(other: EthAddress): number {
    const a = this.toBigNumber();
    const b = other.toBigNumber();

    const diff = a.sub(b);

    if (diff.lt(0)) {
      return -1;
    } else if (diff.eq(0)) {
      return 0;
    } else {
      return 1;
    }
  }
}

export interface Fp96 {
  inner: BigNumber;
}

export const Fp96One = BigNumber.from(2).pow(96);

export class RationalNumber {
  private static readonly regex: RegExp = /^(-)?(\d+)(\.\d+)?$/;
  public readonly nom: BigNumber;
  public readonly denom: BigNumber;

  private constructor(nom: BigNumber, denom: BigNumber) {
    this.nom = nom;
    this.denom = denom;
  }

  private static trimLeftZeros(str: string): string {
    for (let i = 0; i < str.length; i++) {
      if (str[i] !== '0') {
        return str.substring(i);
      }
    }
    return str;
  }

  private static trimRightZeros(str: string): string {
    for (let i = str.length - 1; i >= 0; i--) {
      if (str[i] !== '0') {
        return str.substring(0, i + 1);
      }
    }
    return str;
  }

  public static parse(str: string): RationalNumber {
    const match = str.match(this.regex);
    if (match === null) {
      throw new Error(`Can not parse rational number '${str}'`);
    }

    const sign = match[1] === '-' ? -1 : 1;
    const integerStr = this.trimLeftZeros(match[2]);

    let fractionalStr = match[3];
    if (fractionalStr === undefined) {
      fractionalStr = '';
    } else {
      // remove dot
      fractionalStr = fractionalStr.substring(1);
      fractionalStr = this.trimRightZeros(fractionalStr);
    }

    const denomStr = '1' + '0'.repeat(fractionalStr.length);

    let nomStr = integerStr + fractionalStr;
    if (nomStr === '') {
      nomStr = '0';
    }

    return new RationalNumber(BigNumber.from(nomStr).mul(sign), BigNumber.from(denomStr));
  }

  public static parsePercent(str: string): RationalNumber {
    if (str.length < 1 || str[str.length - 1] !== '%') {
      throw new Error(`Invalid percent string '${str}'`);
    }
    // remove trailing %
    const numberStr = str.substring(0, str.length - 1);
    const rational = this.parse(numberStr);

    return new RationalNumber(rational.nom, rational.denom.mul(100));
  }

  public mul(num: BigNumber): RationalNumber {
    return new RationalNumber(this.nom.mul(num), this.denom);
  }

  public toFp96(): Fp96 {
    return { inner: this.nom.mul(Fp96One).div(this.denom) };
  }

  public toInteger(): BigNumber {
    return this.nom.div(this.denom);
  }
}
