import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Contract } from 'ethers';

type Fixture<T> = () => Promise<T>;

declare module 'mocha' {
  export interface Context {
    sbt: Contract;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: Signers;
  }
}

export interface Signers {
  admin: HardhatEthersSigner;
  users: HardhatEthersSigner[];
}
