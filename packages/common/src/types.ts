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
