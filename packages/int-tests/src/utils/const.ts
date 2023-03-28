import { parseEther, parseUnits } from 'ethers/lib/utils';

export const TREASURY_ACC_SEC =
  process.env.WALLET_ADDRESS ?? `0x4dd1f7853077c31d5a5ca4b6163e194cdca25047a891d24fac0c16f77aa89f44`;
export const INITIAL_BALANCE = process.env.INITIAL_BALANCE ?? `1000000000000.0`;
export const INITIAL_ETH = parseEther(INITIAL_BALANCE);
export const INITIAL_USDC = parseUnits(INITIAL_BALANCE, 6);
export const SECS_PER_BLOCK = process.env.SECS_PER_BLOCK ? +process.env.SECS_PER_BLOCK : 6;
export const USDC_OWNER_ADDR = `0xFcb19e6a322b27c06842A71e8c725399f049AE3a`;
