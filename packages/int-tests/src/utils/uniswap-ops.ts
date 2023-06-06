import { Web3Provider } from '@ethersproject/providers';
import { BigNumber, constants, Wallet, ethers } from 'ethers';
import { ContractsCollection } from './types';
import bn from 'bignumber.js';
import { logger } from './logger';
import { tickToPrice } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { WETH9Contract } from '../contract-api/WETH9';
import { SwapRouterContract } from '../contract-api/SwapRouter';
import { UniswapV3PoolContract } from '../contract-api/UniswapV3Pool';
import { FiatTokenV2_1Contract } from '../contract-api/FiatTokenV2';

// from TickMath
const MIN_TICK = -887272;
const MAX_TICK = -MIN_TICK;

function sqrt(value: BigNumber): BigNumber {
  return BigNumber.from(new bn(value.toString()).sqrt().toFixed().split('.')[0]);
}

// todo: inner func with owners and lprovider and export with treasury only
export async function addLiquidity(
  treasury: Wallet,
  provider: Web3Provider,
  { weth, usdc, nonFungiblePositionManager, uniswap }: ContractsCollection,
  usdcDeposit: BigNumber
) {
  const address = await treasury.getAddress();
  const [usdcBalance, wethBalance] = await Promise.all([usdc.balanceOf(address), weth.balanceOf(address)]);

  const { tick } = await uniswap.connect(provider).slot0();

  const USDC = new Token(1, usdc.address, 6, 'USDC');
  const WETH = new Token(1, weth.address, 18, 'WETH');
  // const DAI = new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')

  const wethPrice = BigNumber.from(tickToPrice(WETH, USDC, Number(tick)).toFixed(0));
  console.log(`WETH PRICE: ${wethPrice}`);
  console.log(`usdcDeposit:::: ${usdcDeposit.toString()}`);
  const wethDeposit0 = usdcDeposit.mul('1000000000000');
  console.log(`wethDeposit0:::: ${wethDeposit0.toString()}`);

  const wethDeposit = wethDeposit0.div(wethPrice);
  console.log(`wethDeposit:::: ${wethDeposit.toString()}`);

  if (usdcDeposit.gt(usdcBalance)) {
    const additionalMint = usdcDeposit.sub(usdcBalance);
    const usdcMintTx = await usdc.connect(treasury).mint(address, additionalMint, { gasLimit: 3000000 });
    await usdcMintTx.wait();
  }

  if (wethDeposit.gt(wethBalance)) {
    const additionalMint = wethDeposit.sub(wethBalance);
    const wethMintTx = await weth.connect(treasury).deposit({ value: additionalMint, gasLimit: 3000000 });
    await wethMintTx.wait();
  }

  const usdcApproveTx = await usdc.connect(treasury).approve(nonFungiblePositionManager.address, constants.MaxUint256);
  await usdcApproveTx.wait();

  const wethApproveTx = await weth.connect(treasury).approve(nonFungiblePositionManager.address, constants.MaxUint256);
  await wethApproveTx.wait();

  const now = Math.floor(Date.now() / 1000);

  const tickDelta = BigNumber.from(tick).mul(5).div(10000);
  const tickLower = BigNumber.from(tick).sub(tickDelta);
  const tickUpper = BigNumber.from(tick).add(tickDelta);
  console.log(`tickDelta:`, tickDelta.toString());
  console.log(`tickLower:`, tickLower.toString());
  console.log(`tick:`, tick);
  console.log(`tickUpper:`, tickUpper.toString());

  console.log(`usdcDeposit:`, usdcDeposit.toString());
  console.log(`wethDeposit:`, wethDeposit.toString());

  console.log(`Before mint`);
  const mintTx = await nonFungiblePositionManager.connect(treasury).mint(
    {
      token0: await uniswap.token0(),
      token1: await uniswap.token1(),
      fee: await uniswap.fee(),
      tickLower: MIN_TICK,
      tickUpper: MAX_TICK,
      amount0Desired: usdcDeposit,
      amount1Desired: wethDeposit,
      amount0Min: 0,
      amount1Min: 0,
      recipient: address,
      deadline: now + 10000000,
    },
    { gasLimit: 1_000_000 }
  );
  const receipt = await mintTx.wait();

  let abi = ['event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'];
  let iface = new ethers.utils.Interface(abi);

  const event = receipt.logs.find((x) => {
    try {
      iface.parseLog(x);
      return true;
    } catch {
      return undefined;
    }
  });
  if (event === undefined) {
    throw new Error(`IncreaseLiquidity event not found`);
  }

  const { tokenId, liquidity, amount0, amount1 } = iface.parseLog(event).args;
  logger.info(
    `addLiquidity: New position id: ${tokenId}, liquidity: ${liquidity}, amount0: ${amount0}, amount1: ${amount1}`
  );
}

export async function changeWethPrice(
  treasury: Wallet,
  provider: Web3Provider,
  {
    weth,
    usdc,
    uniswap,
    swapRouter,
  }: {
    weth: WETH9Contract;
    usdc: FiatTokenV2_1Contract;
    uniswap: UniswapV3PoolContract;
    swapRouter: SwapRouterContract;
  },
  targetPrice: BigNumber
) {
  logger.info(`Start changing price, target: ${targetPrice.toString()}`);
  const { tick } = await uniswap.connect(provider).slot0();
  const USDC = new Token(1, usdc.address, 6, 'USDC');
  const WETH = new Token(1, weth.address, 18, 'WETH');

  const wethPrice = BigNumber.from(tickToPrice(WETH, USDC, Number(tick)).toFixed(0));
  logger.info(`WETH price is ${wethPrice}`);
  logger.info(`WETH balance uniswap ${formatUnits(await weth.balanceOf(uniswap.address), 18)}`);
  logger.info(`USDC balance uniswap ${formatUnits(await usdc.balanceOf(uniswap.address), 6)}`);

  const decreasingPrice = wethPrice.gt(targetPrice);

  let amountIn = decreasingPrice
    ? parseUnits('2000', 18) // 2000 ETH
    : parseUnits('3200000', 6); //3_200_000 USDC
  const depositAmount = amountIn.mul(1_000_000);

  if (decreasingPrice) {
    await (await weth.connect(treasury).deposit({ value: depositAmount, gasLimit: 3000000 })).wait();
    await (await weth.connect(treasury).approve(swapRouter.address, depositAmount)).wait();
  } else {
    await (await usdc.connect(treasury).mint(treasury.address, depositAmount, { gasLimit: 3000000 })).wait();
    await (await usdc.connect(treasury).approve(swapRouter.address, depositAmount)).wait();
  }

  const fee = await uniswap.fee();
  let currentPrice = wethPrice;
  let priceDelta = BigNumber.from(0);

  while (decreasingPrice ? currentPrice.gt(targetPrice) : targetPrice.gt(currentPrice)) {
    const currentBlockNumber = await provider.getBlockNumber();
    const now = (await provider.getBlock(currentBlockNumber)).timestamp;

    const [tokenIn, tokenOut] = decreasingPrice ? [weth.address, usdc.address] : [usdc.address, weth.address];

    const priceLeft = targetPrice.sub(currentPrice).abs();
    if (priceDelta.gt(priceLeft)) {
      amountIn = amountIn.mul(priceLeft).div(priceDelta);
    }

    await (
      await swapRouter.connect(treasury).exactInputSingle(
        {
          tokenIn,
          tokenOut,
          fee,
          recipient: treasury.address,
          deadline: now + 10000,
          amountIn,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        },
        { gasLimit: 1_900_000 }
      )
    ).wait();

    const { tick } = await uniswap.connect(provider).slot0();
    const price = BigNumber.from(tickToPrice(WETH, USDC, Number(tick)).toFixed(0));
    priceDelta = price.sub(currentPrice).abs();
    currentPrice = price;
    logger.info(`  WETH price is ${currentPrice}`);
    logger.info(`  uniswap WETH balance  is ${formatUnits(await weth.balanceOf(uniswap.address), 18)}`);
    logger.info(`  uniswap USDC balance is ${formatUnits(await usdc.balanceOf(uniswap.address), 6)}`);
  }

  {
    const { tick } = await uniswap.connect(provider).slot0();
    const wethPrice = BigNumber.from(tickToPrice(WETH, USDC, Number(tick)).toFixed(0));
    logger.info(`WETH price is ${wethPrice}`);
    logger.info(`uniswap WETH balance  is ${formatUnits(await weth.balanceOf(uniswap.address), 18)}`);
    logger.info(`uniswap USDC balance is ${formatUnits(await usdc.balanceOf(uniswap.address), 6)}`);
  }
  logger.info(`Price changed`);
}
