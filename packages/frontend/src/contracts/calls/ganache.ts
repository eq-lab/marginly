import { ethers } from 'ethers';

export async function increaseForkTimeCall(
  provider: ethers.providers.JsonRpcProvider,
  deltaSec: number
): Promise<void> {
  await provider.send('evm_increaseTime', [deltaSec]);
  await provider.send('evm_mine', []);
}

export async function increaseForkBlockCall(
  provider: ethers.providers.JsonRpcProvider,
  deltaBlock: number
): Promise<void> {
  await provider.send('evm_mine', [{ blocks: deltaBlock }]);
}
