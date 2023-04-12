import * as ethers from 'ethers';
import * as path from 'path';
import fs from 'fs';

export interface ContractDescription {
  abi: ethers.utils.Interface;
  bytecode: string;
}

export type ContractReader = (name: string) => ContractDescription;

export const createContractReader =
  (contractRoot: string) =>
  (name: string): ContractDescription => {
    return JSON.parse(fs.readFileSync(`${contractRoot}${path.sep}${name}.json`, 'utf-8'));
  };

import { BigNumber } from '@ethersproject/bignumber';

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

export * from './command/keyring';
export * from './log';
export * from './sensitive';
export * from './signer';
export * from './system-context';
export * from './utils';
