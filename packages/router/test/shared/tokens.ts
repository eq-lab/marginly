// Addresses of tokens `balanceOf` storage slot.
// Used to set ERC20 account balance on fork
// internal details: https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html#mappings-and-dynamic-arrays
import { EthAddress } from '@marginly/common';
import { keccak256 } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

export enum ArbMainnetERC20BalanceOfSlot {
  USDC = '0000000000000000000000000000000000000000000000000000000000000009',
  WETH = '0000000000000000000000000000000000000000000000000000000000000033',
  FRXETH = '0000000000000000000000000000000000000000000000000000000000000000',
  PTWEETH = '0000000000000000000000000000000000000000000000000000000000000000',
}

function getAccountBalanceStorageSlot(account: EthAddress, tokenMappingSlot: string): string {
  return keccak256('0x' + account.toString().slice(2).padStart(64, '0') + tokenMappingSlot);
}

export async function setTokenBalance(
  tokenAddress: string,
  balanceOfSlotAddress: string,
  account: EthAddress,
  newBalance: BigNumber
) {
  const balanceOfStorageSlot = getAccountBalanceStorageSlot(account, balanceOfSlotAddress);

  await ethers.provider.send('hardhat_setStorageAt', [
    tokenAddress,
    balanceOfStorageSlot,
    ethers.utils.hexlify(ethers.utils.zeroPad(newBalance.toHexString(), 32)),
  ]);
}
