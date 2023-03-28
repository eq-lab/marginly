import { Web3Provider } from '@ethersproject/providers';
import { logger } from './logger';
import { INITIAL_BALANCE, INITIAL_ETH, INITIAL_USDC, USDC_OWNER_ADDR } from './const';
import assert = require('assert');
import { formatEther, formatUnits } from 'ethers/lib/utils';
import { Signer } from 'ethers';
import { usdcContract, wethContract } from './known-contracts';
import { FiatTokenV2_1Contract } from '../contract-api/FiatTokenV2';
import { WETH9Contract } from '../contract-api/WETH9';

export async function initWeth(signer: Signer, provider: Web3Provider): Promise<WETH9Contract> {
  const weth = wethContract(provider);
  const address = await signer.getAddress();
  logger.info(`weth erc20 address: ${weth.address}`);

  const depositTx = await weth
    .connect(signer)
    .deposit({ value: INITIAL_ETH, gasPrice: 200000000000, gasLimit: 300000 });
  await depositTx.wait();

  assert.equal(formatEther(await weth.balanceOf(address)), INITIAL_BALANCE);
  return weth;
}

export async function initUsdc(signer: Signer, provider: Web3Provider): Promise<FiatTokenV2_1Contract> {
  const usdc = usdcContract(provider);
  const address = await signer.getAddress();
  logger.info(`usdc erc20 address: ${usdc.address}`);

  const usdcOwnerSigner = await provider.getSigner(USDC_OWNER_ADDR);

  const transferOwnershipTx = await usdc.connect(usdcOwnerSigner).transferOwnership(address);

  await transferOwnershipTx.wait();

  const updateMasterMinterTx = await usdc.connect(signer).updateMasterMinter(address);
  await updateMasterMinterTx.wait();

  const configureMinterTx = await usdc.connect(signer).configureMinter(address, INITIAL_USDC.mul(10));
  await configureMinterTx.wait();

  const mintTx = await usdc.connect(signer).mint(address, INITIAL_USDC);
  await mintTx.wait();

  assert.equal(formatUnits(await usdc.balanceOf(address), 6), INITIAL_BALANCE);
  return usdc;
}
