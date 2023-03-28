import { ContractStateDescription } from './index';
import { ethers } from 'ethers';
import { tickToPrice } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import { ContractsParams } from '../../connection';

export const basePriceState: ContractStateDescription = {
  stateName: 'Base token price',
  valueUnits: 'Quote tokens',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    args: string[],
    contractsContext: ContractsParams
  ): Promise<string[]> => {
    const {
      baseTokenContract: baseToken,
      quoteTokenContract: quoteToken,
      uniswapPoolContract: uniswap,
    } = contractsContext;

    const { tick } = await uniswap.slot0();
    const baseTokenDecimals = await baseToken.decimals();
    const quoteTokenDecimals = await quoteToken.decimals();

    const baseTokenSymbol = await baseToken.symbol();
    const quoteTokenSymbol = await quoteToken.symbol();
    const chainId = (await baseToken.provider.getNetwork()).chainId;
    const base = new Token(chainId, baseToken.address, baseTokenDecimals, baseTokenSymbol);
    const quote = new Token(chainId, quoteToken.address, quoteTokenDecimals, quoteTokenSymbol);

    const wethPrice = tickToPrice(base, quote, Number(tick)).toFixed(4);
    return [wethPrice];
  },
};

export const uniswapPoolStatesWithoutArgs = [basePriceState];
