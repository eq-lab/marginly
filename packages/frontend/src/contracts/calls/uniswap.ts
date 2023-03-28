import { ContractMethodDescription } from './index';
import { BigNumber, ethers } from 'ethers';
import { sendTransaction } from './common';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { tickToPrice } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import { ContractsParams } from '../../connection';

const changePriceCall: ContractMethodDescription = {
  methodName: 'changePrice',
  argsNames: ['price'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 1) {
      console.error(`changePriceCall: invalid count of args`);
      return;
    }
    const targetPrice = BigNumber.from(args[0]);
    const {
      baseTokenContract: baseToken,
      quoteTokenContract: quoteToken,
      swapRouterContract: swapRouter,
      uniswapPoolContract: uniswap,
    } = contractsContext;

    console.info(`Start changing price, target: ${targetPrice.toString()}`);
    const signerAddress = await signer.getAddress();
    const provider = baseToken.provider;

    const { tick } = await uniswap.slot0();
    const baseTokenDecimals = await baseToken.decimals();
    const quoteTokenDecimals = await quoteToken.decimals();

    const baseTokenSymbol = await baseToken.symbol();
    const quoteTokenSymbol = await quoteToken.symbol();
    const chainId = (await baseToken.provider.getNetwork()).chainId;
    const base = new Token(chainId, baseToken.address, baseTokenDecimals, baseTokenSymbol);
    const quote = new Token(chainId, quoteToken.address, quoteTokenDecimals, quoteTokenSymbol);

    const wethPrice = BigNumber.from(tickToPrice(base, quote, Number(tick)).toFixed(0));
    console.info(`WETH price is ${wethPrice}`);
    console.info(`WETH balance uniswap ${formatUnits(await baseToken.balanceOf(uniswap.address), baseTokenDecimals)}`);
    console.info(
      `USDC balance uniswap ${formatUnits(await quoteToken.balanceOf(uniswap.address), quoteTokenDecimals)}`
    );

    const decreasingPrice = wethPrice.gt(targetPrice);

    let amountIn = decreasingPrice
      ? parseUnits('2000', baseTokenDecimals) // 2000 ETH
      : parseUnits('3200000', quoteTokenDecimals); //3_200_000 USDC
    const depositAmount = amountIn.mul(1_000_000);

    if (decreasingPrice) {
      // await sendTransaction(baseToken, signer, 'deposit', [], gasLimit, gasPrice, depositAmount.toString());
      await sendTransaction(
        baseToken,
        signer,
        'approve',
        [swapRouter.address, depositAmount.toString()],
        gasLimit,
        gasPrice
      );
    } else {
      // await (await quoteToken.mint(signerAddress, depositAmount, { gasLimit: 3000000 })).wait();
      await sendTransaction(
        quoteToken,
        signer,
        'approve',
        [swapRouter.address, depositAmount.toString()],
        gasLimit,
        gasPrice
      );
    }

    const fee = await uniswap.fee();
    let currentPrice = wethPrice;
    let priceDelta = BigNumber.from(0);

    while (decreasingPrice ? currentPrice.gt(targetPrice) : targetPrice.gt(currentPrice)) {
      const currentBlockNumber = await provider.getBlockNumber();
      const now = (await provider.getBlock(currentBlockNumber)).timestamp;

      const [tokenIn, tokenOut] = decreasingPrice
        ? [baseToken.address, quoteToken.address]
        : [quoteToken.address, baseToken.address];

      const priceLeft = targetPrice.sub(currentPrice).abs();
      if (priceDelta.gt(priceLeft)) {
        amountIn = amountIn.mul(priceLeft).div(priceDelta);
      }

      await sendTransaction(
        swapRouter,
        signer,
        'exactInputSingle',
        [
          {
            tokenIn,
            tokenOut,
            fee,
            recipient: signerAddress,
            deadline: now + 10000,
            amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
          },
        ],
        gasLimit,
        gasPrice
      );

      const { tick } = await uniswap.slot0();
      const price = BigNumber.from(tickToPrice(base, quote, Number(tick)).toFixed(0));
      priceDelta = price.sub(currentPrice).abs();
      currentPrice = price;
      console.info(`  WETH price is ${currentPrice}`);
      console.info(
        `  uniswap WETH balance  is ${formatUnits(await baseToken.balanceOf(uniswap.address), baseTokenDecimals)}`
      );
      console.info(
        `  uniswap USDC balance is ${formatUnits(await quoteToken.balanceOf(uniswap.address), quoteTokenDecimals)}`
      );
    }

    {
      const { tick } = await uniswap.slot0();
      const wethPrice = BigNumber.from(tickToPrice(base, quote, Number(tick)).toFixed(0));
      console.info(`WETH price is ${wethPrice}`);
      console.info(
        `uniswap WETH balance  is ${formatUnits(await baseToken.balanceOf(uniswap.address), baseTokenDecimals)}`
      );
      console.info(
        `uniswap USDC balance is ${formatUnits(await quoteToken.balanceOf(uniswap.address), quoteTokenDecimals)}`
      );
    }
    console.info(`Price changed`);
  },
};

export const uniswapMethods = [changePriceCall];
