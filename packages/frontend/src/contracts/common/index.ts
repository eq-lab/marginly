import { BigNumber, ethers } from 'ethers';
import bn from 'bignumber.js';
import ERC20 from '../abi/ERC20.json';

export const FP96 = {
  Q96: 2 ** 96,
  one: BigNumber.from(2).pow(96),
};

export function convertNumberToFP96(num: number): { inner: bigint } {
  return { inner: BigInt(num * FP96.Q96) };
}
export function convertFP96ToNumber(fp96Value: BigNumber): number {
  const tmp = fp96Value.div(2 ** 48);
  return tmp.toNumber() / 2 ** 48;
}

export function toHumanString(fp96Value: BigNumber): string {
  return bn(fp96Value.toString()).div(FP96.one.toString()).toString();
}

export async function getBaseTokenContract(marginlyPool: ethers.Contract): Promise<ethers.Contract> {
  const contractAddress = await marginlyPool.baseToken();
  const erc20ContractDescription = ERC20;
  return new ethers.Contract(contractAddress, erc20ContractDescription.abi, marginlyPool.provider);
}

export async function getQuoteTokenContract(marginlyPool: ethers.Contract): Promise<ethers.Contract> {
  const contractAddress = await marginlyPool.quoteToken();
  const erc20ContractDescription = ERC20;
  return new ethers.Contract(contractAddress, erc20ContractDescription.abi, marginlyPool.provider);
}

export enum PositionType {
  Uninitialized,
  Lend,
  Short,
  Long,
}

export function positionEnumToStr(posType: PositionType): string {
  switch (posType) {
    case PositionType.Uninitialized:
      return 'Uninitialized';
    case PositionType.Lend:
      return 'Lend';
    case PositionType.Short:
      return 'Short';
    case PositionType.Long:
      return 'Long';
    default:
      return 'error';
  }
}
export type Position = {
  heapPosition: Number;
  type: PositionType;
  discountedBaseAmount: BigNumber;
  discountedQuoteAmount: BigNumber;
};

export async function getPosition(marginlyPool: ethers.Contract, userAddress: string): Promise<Position> {
  const [heapPosition, positionType, discountedBaseAmount, discountedQuoteAmount] = await marginlyPool.positions(
    userAddress
  );

  return { heapPosition, type: positionType, discountedBaseAmount, discountedQuoteAmount };
}
