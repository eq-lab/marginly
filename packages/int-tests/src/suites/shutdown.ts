import { BigNumber } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { FP96 } from '../utils/fixed-point';
import { logger } from '../utils/logger';
import { changeWethPrice } from '../utils/uniswap-ops';
import { showSystemAggregates } from '../utils/log-utils';
import { prepareAccounts } from './simulation';

/*
System shutdown case, when price of WETH token drastically increased
ShortEmergency
*/
export async function shortEmergency(sut: SystemUnderTest) {
  logger.info(`Starting shortEmergency test suite`);
  const { marginlyPool, usdc, weth, accounts, treasury, provider } = sut;

  await prepareAccounts(sut);

  const lender = accounts[0];
  const shorter = accounts[1];
  const longer = accounts[2];

  const params = await marginlyPool.params();
  await (
    await marginlyPool.connect(treasury).setParameters({ ...params, maxLeverage: 20 }, { gasLimit: 400_000 })
  ).wait();

  // lender deposit 2.0 ETH
  const lenderDepositBaseAmount = parseUnits('2', 18);
  logger.info(`Lender deposit ${formatUnits(lenderDepositBaseAmount, 18)} WETH`);
  await (await weth.connect(lender).approve(marginlyPool.address, lenderDepositBaseAmount)).wait();
  await (await marginlyPool.connect(lender).depositBase(lenderDepositBaseAmount, { gasLimit: 400_000 })).wait();
  await showSystemAggregates(sut);

  //shorter deposit 1000 USDC
  const shorterDepositQuote = parseUnits('250', 6);
  logger.info(`Shorter deposit ${formatUnits(shorterDepositQuote, 6)} USDC`);
  await (await usdc.connect(shorter).approve(marginlyPool.address, shorterDepositQuote)).wait();
  await (await marginlyPool.connect(shorter).depositQuote(shorterDepositQuote, { gasLimit: 400_000 })).wait();

  //shorter make short on 2.0 ETH
  const shortAmount = parseUnits('2', 18);
  await (await marginlyPool.connect(shorter).short(shortAmount, { gasLimit: 900_000 })).wait();
  logger.info(`Short to ${formatUnits(shortAmount, 18)} WETH`);
  await showSystemAggregates(sut);

  // longer deposit 0.1 ETH
  const longDepositBase = parseUnits('0.1', 18);
  logger.info(`Longer deposit ${formatUnits(longDepositBase, 18)} WETH`);
  await (await weth.connect(longer).approve(marginlyPool.address, longDepositBase)).wait();
  await (await marginlyPool.connect(longer).depositBase(longDepositBase, { gasLimit: 400_000 })).wait();

  // longer make long on 1.8 ETH
  const longAmount = parseUnits('0.5', 18);
  logger.info(`Long to ${formatUnits(longAmount, 18)} WETH`);
  await (await marginlyPool.connect(longer).long(longAmount, { gasLimit: 900_000 })).wait();
  await showSystemAggregates(sut);

  const wethPriceX96 = BigNumber.from((await marginlyPool.getBasePrice()).inner).mul(10n ** 12n);

  logger.info(`Increasing WETH price by ~80%`);
  await changeWethPrice(treasury, provider.provider, sut, wethPriceX96.mul(18).div(10).div(FP96.one));

  //shift dates and reinit
  logger.info(`Shift date for 1 month, 1 day per iteration`);
  // shift time to 1 year
  const numOfSeconds = 24 * 60 * 60; // 1 day
  let nextDate = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 30; i++) {
    logger.info(`Iteration ${i + 1} of 30`);
    nextDate += numOfSeconds;
    await provider.mineAtTimestamp(nextDate);

    try {
      const txReceipt = await (await marginlyPool.connect(treasury).reinit({ gasLimit: 500_000 })).wait();
      const marginCallEvent = txReceipt.events?.find((e) => e.event == 'EnactMarginCall');
      if (marginCallEvent) {
        logger.info(`\n`);
        logger.warn(`Margin call happened at day ${i} (${nextDate} time)`);
        logger.warn(` mc account: ${marginCallEvent.args![0]}`);
      }
    } catch {
      // we are in  liquidity shortage state try to receive position and continue
      logger.warn(`⛔️ Pool liquidity not enough to cover position debt`);
      logger.info(`   bad position ${shorter.address}`);

      await showSystemAggregates(sut);

      await (await marginlyPool.connect(treasury).shutDown({ gasLimit: 500_000 })).wait();
      break;
    }

    await showSystemAggregates(sut);
  }

  /* emergencyWithdraw */

  await (await marginlyPool.connect(longer).emergencyWithdraw({ gasLimit: 400_000 })).wait();
  await (await marginlyPool.connect(lender).emergencyWithdraw({ gasLimit: 400_000 })).wait();

  await showSystemAggregates(sut);
}

export async function longEmergency(sut: SystemUnderTest) {
  logger.info(`Starting longEmergency test suite`);
  const { marginlyPool, usdc, weth, accounts, treasury, provider } = sut;

  await prepareAccounts(sut);

  const lender = accounts[0];
  const shorter = accounts[1];
  const longer = accounts[2];

  // lender deposit 3200 USDC
  const lenderDepositQuoteAmount = parseUnits('3200', 6);
  logger.info(`Lender deposit ${formatUnits(lenderDepositQuoteAmount, 6)} UDSC`);
  await (await usdc.connect(lender).approve(marginlyPool.address, lenderDepositQuoteAmount)).wait();
  await (await marginlyPool.connect(lender).depositQuote(lenderDepositQuoteAmount, { gasLimit: 400_000 })).wait();
  await showSystemAggregates(sut);

  // longer deposit 0.3 ETH
  const longDepositBase = parseUnits('0.2', 18);
  logger.info(`Longer deposit ${formatUnits(longDepositBase, 18)} WETH`);
  await (await weth.connect(longer).approve(marginlyPool.address, longDepositBase)).wait();
  await (await marginlyPool.connect(longer).depositBase(longDepositBase, { gasLimit: 400_000 })).wait();

  // longer make long on 1.8 ETH
  const longAmount = parseUnits('1.8', 18);
  logger.info(`Long to ${formatUnits(longAmount, 18)} WETH`);
  await (await marginlyPool.connect(longer).long(longAmount, { gasLimit: 900_000 })).wait();
  await showSystemAggregates(sut);

  //shorter deposit 300 USDC
  const shorterDepositQuote = parseUnits('600', 6);
  logger.info(`Shorter deposit ${formatUnits(shorterDepositQuote, 6)} USDC`);
  await (await usdc.connect(shorter).approve(marginlyPool.address, shorterDepositQuote)).wait();
  await (await marginlyPool.connect(shorter).depositQuote(shorterDepositQuote, { gasLimit: 400_000 })).wait();

  //shorter make short on 2.0 ETH
  const shortAmount = parseUnits('2', 18);
  await (await marginlyPool.connect(shorter).short(shortAmount, { gasLimit: 900_000 })).wait();
  logger.info(`Short to ${formatUnits(shortAmount, 18)} WETH`);
  await showSystemAggregates(sut);

  const wethPriceX96 = BigNumber.from((await marginlyPool.getBasePrice()).inner).mul(10n ** 12n);

  logger.info(`Decreasing WETH price by ~40%`);
  await changeWethPrice(treasury, provider.provider, sut, wethPriceX96.mul(6).div(10).div(FP96.one));

  //shift dates and reinit
  logger.info(`Shift date for 1 month, 1 day per iteration`);
  // shift time to 1 year
  const numOfSeconds = 24 * 60 * 60; // 1 day
  let nextDate = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 30; i++) {
    logger.info(`Iteration ${i + 1} of 30`);
    nextDate += numOfSeconds;
    await provider.mineAtTimestamp(nextDate);

    try {
      const txReceipt = await (await marginlyPool.connect(treasury).reinit({ gasLimit: 500_000 })).wait();
      const marginCallEvent = txReceipt.events?.find((e) => e.event == 'EnactMarginCall');
      if (marginCallEvent) {
        logger.info(`\n`);
        logger.warn(`Margin call happened at day ${i} (${nextDate} time)`);
        logger.warn(` mc account: ${marginCallEvent.args![0]}`);
      }
    } catch {
      // we are in  liquidity shortage state try to receive position and continue
      logger.warn(`⛔️ Pool liquidity not enough to cover position debt`);
      logger.info(`   bad position ${longer.address}`);

      await showSystemAggregates(sut);

      await (await marginlyPool.connect(treasury).shutDown({ gasLimit: 500_000 })).wait();

      logger.info(`🛑 system in switched to emergency mode`);
      break;
    }
    await showSystemAggregates(sut);
  }

  /* emergencyWithdraw */

  await (await marginlyPool.connect(shorter).emergencyWithdraw({ gasLimit: 400_000 })).wait();
  await (await marginlyPool.connect(lender).emergencyWithdraw({ gasLimit: 400_000 })).wait();

  await showSystemAggregates(sut);
}
