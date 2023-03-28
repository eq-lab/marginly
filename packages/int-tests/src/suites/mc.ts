import assert = require('assert');
import { BigNumber } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { logger } from '../utils/logger';
import { decodeSwapEvent } from '../utils/chain-ops';
import { FP96, toHumanString } from '../utils/fixed-point';
import { changeWethPrice } from '../utils/uniswap-ops';

export async function mc(sut: SystemUnderTest) {
  logger.info(`Starting mc test suite`);
  const { marginlyPool, treasury, usdc, weth, accounts, provider, uniswap, gasReporter } = sut;

  const basePrice = BigNumber.from((await marginlyPool.getBasePrice()).inner);

  const numberOfLenders = 20;
  const lenders = accounts.slice(0, numberOfLenders);
  const baseAmount = parseUnits('20', 18); // 20 WETH
  const quoteAmount = parseUnits('20', 18)
    .mul(basePrice)
    .div(FP96.one);

  logger.info(`Deposit quote and base`);
  for (let i = 0; i < lenders.length; i++) {
    await (await weth.connect(treasury).transfer(lenders[i].address, baseAmount)).wait();
    await (await weth.connect(lenders[i]).approve(marginlyPool.address, baseAmount)).wait();

    await gasReporter.saveGasUsage(
      'depositBase',
      marginlyPool.connect(lenders[i]).depositBase(baseAmount, { gasLimit: 500_000 })
    );

    await (await usdc.connect(treasury).transfer(lenders[i].address, quoteAmount)).wait();
    await (await usdc.connect(lenders[i]).approve(marginlyPool.address, quoteAmount)).wait();

    await gasReporter.saveGasUsage(
      'depositQuote',
      marginlyPool.connect(lenders[i]).depositQuote(quoteAmount, { gasLimit: 500_000 })
    );
  }

  const numberOfLongers = 1;
  const longers = accounts.slice(numberOfLenders, numberOfLenders + numberOfLongers);
  const initialLongerBalance = parseUnits('1', 18); // 1 WETH
  logger.info(`borrower initial deposit: ${formatUnits(initialLongerBalance, 18)} WETH`);

  for(let i = 0; i < numberOfLongers; ++i) {
    const longer = longers[i];
    await (await weth.connect(treasury).transfer(longer.address, initialLongerBalance)).wait();
    await (await weth.connect(longer).approve(marginlyPool.address, initialLongerBalance)).wait();

    await gasReporter.saveGasUsage(
      'depositBase',
      marginlyPool.connect(longer).depositBase(initialLongerBalance, { gasLimit: 500_000 })
    );

    const longAmount = parseUnits('18', 18).mul(i + 1);
    logger.info(`Open ${formatUnits(longAmount, 18)} WETH long position`);

    await gasReporter.saveGasUsage('long', marginlyPool.connect(longer).long(longAmount, { gasLimit: 1_500_000 }));
  }

  const numberOfShorters = 1;
  const shorters = 
    accounts.slice(numberOfLenders + numberOfLongers, numberOfLenders + numberOfLongers + numberOfShorters);
  const initialShorterBalance = parseUnits('1', 18) // 1 WETH in USDC
    .mul(basePrice)
    .div(FP96.one);
  logger.info(`borrower initial deposit: ${formatUnits(initialShorterBalance, 18)} WETH`);

  for(let i = 0; i < numberOfShorters; ++i) {
    const shorter = shorters[i];
    await (await usdc.connect(treasury).transfer(shorter.address, initialShorterBalance)).wait();
    await (await usdc.connect(shorter).approve(marginlyPool.address, initialShorterBalance)).wait();

    await gasReporter.saveGasUsage(
      'depositBase',
      marginlyPool.connect(shorter).depositQuote(initialShorterBalance, { gasLimit: 500_000 })
    );

    const shortAmount = parseUnits('18', 18).mul(i + 1);
    logger.info(`Open ${formatUnits(shortAmount, 18)} WETH short position`);

    await gasReporter.saveGasUsage('short', marginlyPool.connect(shorter).short(shortAmount, { gasLimit: 1_500_000 }));
  }

  // 30 days -- 1 mc, 60 days -- 2 mc
  const numOfSeconds = 30 * 24 * 60 * 60; 

  const nextDate = +BigNumber.from(await marginlyPool.lastReinitTimestampSeconds()).add(numOfSeconds);
  await provider.mineAtTimestamp(nextDate);

  const depositer = accounts[numberOfLenders + numberOfLongers + numberOfShorters];

  await (await weth.connect(treasury).transfer(depositer.address, baseAmount)).wait();
  await (await weth.connect(depositer).approve(marginlyPool.address, baseAmount)).wait();

  const txReceipt = await gasReporter.saveGasUsage(
    'depositBase',
    marginlyPool.connect(depositer).depositBase(baseAmount, { gasLimit: 500_000 })
  );

  const mcEventsNumber = txReceipt.events?.filter((e) => e.event == 'EnactMarginCall').length;
  if (mcEventsNumber != 2) {
    logger.warn(`1 margin call didn't happen`);
  }

  if (mcEventsNumber != 1) {
    logger.error(`No margin calls happened`);
    throw Error(`No margin calls happened`);
  }
}
