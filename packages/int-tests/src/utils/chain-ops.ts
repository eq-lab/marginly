import { logger } from '../utils/logger';
import { SECS_PER_BLOCK } from './const';
import { Web3Provider } from '@ethersproject/providers';
import { MarginlyPoolContract } from '../contract-api/MarginlyPool';
import { BigNumber, ethers, ContractReceipt } from 'ethers';

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
