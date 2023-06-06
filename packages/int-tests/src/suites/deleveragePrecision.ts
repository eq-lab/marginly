import assert = require('assert');
import { BigNumber } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { CallType } from '../utils/chain-ops';
import { ZERO_ADDRESS } from '../utils/const';
import { FP96, toHumanString } from '../utils/fixed-point';
import { logger } from '../utils/logger';

const paramsDefaultLeverage = {
  interestRate: 0,
  maxLeverage: 20n,
  swapFee: 0,
  priceSecondsAgo: 900n, // 15 min
  positionSlippage: 20000, // 2%
  mcSlippage: 50000, //5%
  positionMinAmount: 10000000000000000n, // 0,01 ETH
  baseLimit: 10n ** 9n * 10n ** 18n,
  quoteLimit: 10n ** 12n * 10n ** 6n,
};

const paramsLowLeverage = {
  interestRate: 0,
  maxLeverage: 10n,
  swapFee: 0,
  priceSecondsAgo: 900n, // 15 min
  positionSlippage: 20000, // 2%
  mcSlippage: 50000, //5%
  positionMinAmount: 10000000000000000n, // 0,01 ETH
  baseLimit: 10n ** 9n * 10n ** 18n,
  quoteLimit: 10n ** 12n * 10n ** 6n,
};

export async function deleveragePrecisionLong(sut: SystemUnderTest) {
  const { marginlyPool, usdc, weth, accounts, treasury, provider, uniswap, gasReporter } = sut;

  const coeffsTable: { [key: string]: {} } = {};
  const aggregates: { [key: string]: {} } = {};
  const balances: { [key: string]: {} } = {};
  const positions: { [key: string]: {} } = {};

  // we set interest rate as 0 for this test so we don't need to calculate accrued rate
  // liquidations are approached via decreasing maxLeverage
  await marginlyPool.connect(treasury).setParameters(paramsDefaultLeverage);

  const lender = accounts[0];
  const liquidatedLong = accounts[1];
  const shortersNum = 5;
  const shorters = accounts.slice(2, 2 + shortersNum);
  // 20 WETH in total
  const shortersBaseDebt = [
    parseUnits('2', 18),
    parseUnits('3', 18),
    parseUnits('4', 18),
    parseUnits('11', 18),
    parseUnits('20', 18),
  ];

  const lenderBaseAmount = parseUnits('1', 18); // 1 WETH
  const lenderQuoteAmount = parseUnits('200000', 6); // 200000 USDC;

  await (await usdc.connect(treasury).transfer(lender.address, lenderQuoteAmount)).wait();
  await (await usdc.connect(lender).approve(marginlyPool.address, lenderQuoteAmount)).wait();

  await (await weth.connect(treasury).transfer(lender.address, lenderBaseAmount)).wait();
  await (await weth.connect(lender).approve(marginlyPool.address, lenderBaseAmount)).wait();

  logger.info(`Lender deposits quote`);
  await marginlyPool
    .connect(lender)
    .execute(CallType.DepositQuote, lenderQuoteAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
  await addToLogs(
    sut,
    1,
    1,
    shortersNum,
    'Lender depositQuote 1',
    lenderQuoteAmount.toString(),
    '0',
    coeffsTable,
    aggregates,
    balances,
    positions
  );

  logger.info(`Lender deposits base`);
  await marginlyPool
    .connect(lender)
    .execute(CallType.DepositBase, lenderBaseAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
  await addToLogs(
    sut,
    1,
    1,
    shortersNum,
    'Lender depositBase 1',
    lenderBaseAmount.toString(),
    '0',
    coeffsTable,
    aggregates,
    balances,
    positions
  );

  let nextDate = Math.floor(Date.now() / 1000);
  const timeDelta = 24 * 60 * 60;

  for (let i = 0; i < 10; ++i) {
    if (i == 5) {
      await (await usdc.connect(treasury).transfer(lender.address, lenderQuoteAmount)).wait();
      await (await usdc.connect(lender).approve(marginlyPool.address, lenderQuoteAmount)).wait();

      await (await weth.connect(treasury).transfer(lender.address, lenderBaseAmount)).wait();
      await (await weth.connect(lender).approve(marginlyPool.address, lenderBaseAmount)).wait();

      logger.info(`Lender deposits quote`);
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositQuote, lenderQuoteAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
      await addToLogs(
        sut,
        1,
        1,
        shortersNum,
        'Lender depositQuote 2',
        lenderQuoteAmount.toString(),
        '0',
        coeffsTable,
        aggregates,
        balances,
        positions
      );

      logger.info(`Lender deposits base`);
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositBase, lenderBaseAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
      await addToLogs(
        sut,
        1,
        1,
        shortersNum,
        'Lender depositBase 2',
        lenderBaseAmount.toString(),
        '0',
        coeffsTable,
        aggregates,
        balances,
        positions
      );
    }

    logger.info(`iteration ${i + 1}`);
    const longerBaseDeposit = i < 5 ? parseUnits('1', 18) : parseUnits('2', 18);
    await (await weth.connect(treasury).transfer(liquidatedLong.address, longerBaseDeposit)).wait();
    await (await weth.connect(liquidatedLong).approve(marginlyPool.address, longerBaseDeposit)).wait();

    const longerLongAmount = i < 5 ? parseUnits('18', 18) : parseUnits('36', 18); // 18 WETH
    logger.info(`  Longer deposits base`);
    await marginlyPool
      .connect(liquidatedLong)
      .execute(CallType.DepositBase, longerBaseDeposit, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });

    await addToLogs(
      sut,
      1,
      1,
      shortersNum,
      `Longer depositBase ${i}`,
      longerBaseDeposit.toString(),
      '0',
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    logger.info(`  Longer longs`);
    const longTx = await (
      await marginlyPool
        .connect(liquidatedLong)
        .execute(CallType.Long, longerLongAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();

    const swapPrice = BigNumber.from(longTx.events?.find((e) => e.event == 'Long')?.args?.swapPriceX96).mul(10n ** 12n);
    await addToLogs(
      sut,
      1,
      1,
      shortersNum,
      `Longer long ${i}`,
      longerLongAmount.toString(),
      toHumanString(swapPrice),
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    const shortersQuoteDeposit = parseUnits('20000', 6); // 20000 USDC

    const itersNum = i < 5 ? shortersNum - 1 : shortersNum;
    for (let j = 0; j < itersNum; ++j) {
      await (await usdc.connect(treasury).transfer(shorters[j].address, shortersQuoteDeposit)).wait();
      await (await usdc.connect(shorters[j]).approve(marginlyPool.address, shortersQuoteDeposit)).wait();
      logger.info(`  Shorter_${j} deposits quote`);
      await (
        await marginlyPool
          .connect(shorters[j])
          .execute(CallType.DepositQuote, shortersQuoteDeposit, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
      ).wait();
      await addToLogs(
        sut,
        1,
        1,
        shortersNum,
        `Shorter_${j} depositQuote ${i}`,
        shortersQuoteDeposit.toString(),
        '0',
        coeffsTable,
        aggregates,
        balances,
        positions
      );

      logger.info(`  Shorter_${j} shorts`);
      const shortTx = await (
        await marginlyPool
          .connect(shorters[j])
          .execute(CallType.Short, shortersBaseDebt[j], 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
      ).wait();
      const swapPrice = BigNumber.from(shortTx.events?.find((e) => e.event == 'Short')?.args?.swapPriceX96).mul(
        10n ** 12n
      );
      await addToLogs(
        sut,
        1,
        1,
        shortersNum,
        `Shorter_${j} short ${i}`,
        shortersBaseDebt[j].toString(),
        toHumanString(swapPrice),
        coeffsTable,
        aggregates,
        balances,
        positions
      );
    }

    const quoteDelevCoeffBefore = BigNumber.from(await marginlyPool.quoteDelevCoeff());
    const baseDebtCoeffBefore = BigNumber.from(await marginlyPool.baseDebtCoeff());

    logger.info(`  Toggle liquidation`);

    await marginlyPool.connect(treasury).setParameters(paramsLowLeverage, { gasLimit: 500_000 });

    nextDate += timeDelta;
    await provider.mineAtTimestamp(nextDate);
    await (
      await marginlyPool.connect(treasury).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    await addToLogs(sut, 1, 1, shortersNum, `Liquidation ${i}`, `0`, '0', coeffsTable, aggregates, balances, positions);

    await marginlyPool.connect(treasury).setParameters(paramsDefaultLeverage, { gasLimit: 500_000 });

    const quoteDelevCoeffAfter = BigNumber.from(await marginlyPool.quoteDelevCoeff());
    const baseDebtCoeffAfter = BigNumber.from(await marginlyPool.baseDebtCoeff());

    assert(!quoteDelevCoeffBefore.eq(quoteDelevCoeffAfter));
    assert(!baseDebtCoeffBefore.eq(baseDebtCoeffAfter));
    logger.info(`  Liquidation happened`);

    for (let j = 0; j < itersNum; ++j) {
      logger.info(`  Shorter_${j} closes position`);
      const closePosTx = await (
        await marginlyPool
          .connect(shorters[j])
          .execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
      ).wait();
      const swapPrice = BigNumber.from(
        closePosTx.events?.find((e) => e.event == 'ClosePosition')?.args?.swapPriceX96
      ).mul(10n ** 12n);
      await addToLogs(
        sut,
        1,
        1,
        shortersNum,
        `Shorter_${j} closePosition ${i}`,
        '0',
        toHumanString(swapPrice),
        coeffsTable,
        aggregates,
        balances,
        positions
      );

      logger.info(`  Shorter_${j} withdraws all`);
      await marginlyPool
        .connect(shorters[j])
        .execute(CallType.WithdrawQuote, parseUnits('200000', 6), 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
      await addToLogs(
        sut,
        1,
        1,
        shortersNum,
        `Shorter_${j} withdrawQuote all ${i}`,
        `0`,
        '0',
        coeffsTable,
        aggregates,
        balances,
        positions
      );
    }
  }
  console.table(coeffsTable);
  console.table(aggregates);
  console.table(balances);
  console.table(positions);
}

export async function deleveragePrecisionLongWithCollateral(sut: SystemUnderTest) {
  const { marginlyPool, usdc, weth, accounts, treasury, provider, uniswap, gasReporter } = sut;

  const coeffsTable: { [key: string]: {} } = {};
  const aggregates: { [key: string]: {} } = {};
  const balances: { [key: string]: {} } = {};
  const positions: { [key: string]: {} } = {};

  // we set interest rate as 0 for this test so we don't need to calculate accrued rate
  // liquidations are approached via decreasing maxLeverage
  await marginlyPool.connect(treasury).setParameters(paramsDefaultLeverage);

  const lender = accounts[0];
  const liquidatedLong = accounts[1];
  const shorter = accounts[2];

  const lenderBaseAmount = parseUnits('1', 18); // 1 WETH
  const lenderQuoteAmount = parseUnits('18000', 6); // 18000 USDC;

  await (await usdc.connect(treasury).transfer(lender.address, lenderQuoteAmount)).wait();
  await (await usdc.connect(lender).approve(marginlyPool.address, lenderQuoteAmount)).wait();

  await (await weth.connect(treasury).transfer(lender.address, lenderBaseAmount)).wait();
  await (await weth.connect(lender).approve(marginlyPool.address, lenderBaseAmount)).wait();

  logger.info(`Lender deposits quote`);
  await marginlyPool
    .connect(lender)
    .execute(CallType.DepositQuote, lenderQuoteAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
  await addToLogs(
    sut,
    1,
    1,
    1,
    'Lender depositQuote',
    lenderQuoteAmount.toString(),
    '0',
    coeffsTable,
    aggregates,
    balances,
    positions
  );

  logger.info(`Lender deposits base`);
  await marginlyPool
    .connect(lender)
    .execute(CallType.DepositBase, lenderBaseAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
  await addToLogs(
    sut,
    1,
    1,
    1,
    'Lender depositBase',
    lenderBaseAmount.toString(),
    '0',
    coeffsTable,
    aggregates,
    balances,
    positions
  );

  let nextDate = Math.floor(Date.now() / 1000);
  const timeDelta = 24 * 60 * 60;

  for (let i = 0; i < 10; ++i) {
    logger.info(`iteration ${i + 1}`);
    const longerBaseDeposit = parseUnits('1', 18);
    await (await weth.connect(treasury).transfer(liquidatedLong.address, longerBaseDeposit)).wait();
    await (await weth.connect(liquidatedLong).approve(marginlyPool.address, longerBaseDeposit)).wait();

    const longerLongAmount = parseUnits('18', 18);
    logger.info(`  Longer deposits base`);
    await marginlyPool
      .connect(liquidatedLong)
      .execute(CallType.DepositBase, longerBaseDeposit, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });

    await addToLogs(
      sut,
      1,
      1,
      1,
      `Longer depositBase ${i}`,
      longerBaseDeposit.toString(),
      '0',
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    logger.info(`  Longer longs`);
    const longTx = await (
      await marginlyPool
        .connect(liquidatedLong)
        .execute(CallType.Long, longerLongAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();

    let swapPrice = BigNumber.from(longTx.events?.find((e) => e.event == 'Long')?.args?.swapPriceX96).mul(10n ** 12n);
    await addToLogs(
      sut,
      1,
      1,
      1,
      `Longer long ${i}`,
      longerLongAmount.toString(),
      toHumanString(swapPrice),
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    const shortersQuoteDeposit = parseUnits('20000', 6); // 20000 USDC

    await (await usdc.connect(treasury).transfer(shorter.address, shortersQuoteDeposit)).wait();
    await (await usdc.connect(shorter).approve(marginlyPool.address, shortersQuoteDeposit)).wait();
    logger.info(`  Shorter deposits quote`);
    await (
      await marginlyPool
        .connect(shorter)
        .execute(CallType.DepositQuote, shortersQuoteDeposit, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    await addToLogs(
      sut,
      1,
      1,
      1,
      `Shorter depositQuote ${i}`,
      shortersQuoteDeposit.toString(),
      '0',
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    logger.info(`  Shorter shorts`);
    const shorterBaseDebt = parseUnits('13', 18);
    const shortTx = await (
      await marginlyPool
        .connect(shorter)
        .execute(CallType.Short, shorterBaseDebt, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    swapPrice = BigNumber.from(shortTx.events?.find((e) => e.event == 'Short')?.args?.swapPriceX96).mul(10n ** 12n);
    await addToLogs(
      sut,
      1,
      1,
      1,
      `Shorter short ${i}`,
      shorterBaseDebt.toString(),
      toHumanString(swapPrice),
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    const quoteDelevCoeffBefore = BigNumber.from(await marginlyPool.quoteDelevCoeff());
    const baseDebtCoeffBefore = BigNumber.from(await marginlyPool.baseDebtCoeff());

    logger.info(`  Toggle liquidation`);

    await marginlyPool.connect(treasury).setParameters(paramsLowLeverage, { gasLimit: 500_000 });

    nextDate += timeDelta;
    await provider.mineAtTimestamp(nextDate);
    await (
      await marginlyPool.connect(treasury).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    await addToLogs(sut, 1, 1, 1, `Liquidation ${i}`, `0`, '0', coeffsTable, aggregates, balances, positions);

    await marginlyPool.connect(treasury).setParameters(paramsDefaultLeverage, { gasLimit: 500_000 });

    const quoteDelevCoeffAfter = BigNumber.from(await marginlyPool.quoteDelevCoeff());
    const baseDebtCoeffAfter = BigNumber.from(await marginlyPool.baseDebtCoeff());

    assert(!quoteDelevCoeffBefore.eq(quoteDelevCoeffAfter));
    assert(!baseDebtCoeffBefore.eq(baseDebtCoeffAfter));
    logger.info(`  Liquidation happened`);

    logger.info(`  Shorter closes position`);
    const closePosTx = await (
      await marginlyPool
        .connect(shorter)
        .execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    swapPrice = BigNumber.from(closePosTx.events?.find((e) => e.event == 'ClosePosition')?.args?.swapPriceX96).mul(
      10n ** 12n
    );
    await addToLogs(
      sut,
      1,
      1,
      1,
      `Shorter closePosition ${i}`,
      '0',
      toHumanString(swapPrice),
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    logger.info(`  Shorter withdraws all`);
    await marginlyPool
      .connect(shorter)
      .execute(CallType.WithdrawQuote, parseUnits('200000', 6), 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
    await addToLogs(
      sut,
      1,
      1,
      1,
      `Shorter withdrawQuote all ${i}`,
      `0`,
      '0',
      coeffsTable,
      aggregates,
      balances,
      positions
    );
  }
  console.table(coeffsTable);
  console.table(aggregates);
  console.table(balances);
  console.table(positions);
}

export async function deleveragePrecisionShort(sut: SystemUnderTest) {
  const { marginlyPool, usdc, weth, accounts, treasury, provider, uniswap, gasReporter } = sut;

  const coeffsTable: { [key: string]: {} } = {};
  const aggregates: { [key: string]: {} } = {};
  const balances: { [key: string]: {} } = {};
  const positions: { [key: string]: {} } = {};

  // we set interest rate as 0 for this test so we don't need to calculate accrued rate
  // liquidations are approached via decreasing maxLeverage
  await marginlyPool.connect(treasury).setParameters(paramsDefaultLeverage);

  const lender = accounts[0];
  const longersNum = 5;
  const longers = accounts.slice(1, 1 + longersNum);
  const liquidatedShort = accounts[1 + longersNum];

  // 20 WETH in total
  const longersLongAmount = [
    parseUnits('2', 18),
    parseUnits('3', 18),
    parseUnits('4', 18),
    parseUnits('11', 18),
    parseUnits('20', 18),
  ];

  const price = (await marginlyPool.getBasePrice()).inner;

  const lenderBaseAmount = parseUnits('100', 18); // 100 WETH
  const lenderQuoteAmount = parseUnits('1', 18).mul(price).div(FP96.one); // USDC equivalent of 1 WETH

  await (await usdc.connect(treasury).transfer(lender.address, lenderQuoteAmount)).wait();
  await (await usdc.connect(lender).approve(marginlyPool.address, lenderQuoteAmount)).wait();

  await (await weth.connect(treasury).transfer(lender.address, lenderBaseAmount)).wait();
  await (await weth.connect(lender).approve(marginlyPool.address, lenderBaseAmount)).wait();

  logger.info(`Lender deposits quote`);
  await marginlyPool
    .connect(lender)
    .execute(CallType.DepositQuote, lenderQuoteAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
  await addToLogs(
    sut,
    1,
    longersNum,
    1,
    'Lender depositQuote 1',
    lenderQuoteAmount.toString(),
    '0',
    coeffsTable,
    aggregates,
    balances,
    positions
  );

  logger.info(`Lender deposits base`);
  await marginlyPool
    .connect(lender)
    .execute(CallType.DepositBase, lenderBaseAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
  await addToLogs(
    sut,
    1,
    longersNum,
    1,
    'Lender depositBase 1',
    lenderBaseAmount.toString(),
    '0',
    coeffsTable,
    aggregates,
    balances,
    positions
  );

  let nextDate = Math.floor(Date.now() / 1000);
  const timeDelta = 24 * 60 * 60;

  for (let i = 0; i < 10; ++i) {
    if (i == 5) {
      await (await usdc.connect(treasury).transfer(lender.address, lenderQuoteAmount)).wait();
      await (await usdc.connect(lender).approve(marginlyPool.address, lenderQuoteAmount)).wait();

      await (await weth.connect(treasury).transfer(lender.address, lenderBaseAmount)).wait();
      await (await weth.connect(lender).approve(marginlyPool.address, lenderBaseAmount)).wait();

      logger.info(`Lender deposits quote`);
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositQuote, lenderQuoteAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
      await addToLogs(
        sut,
        1,
        longersNum,
        1,
        'Lender depositQuote 2',
        lenderQuoteAmount.toString(),
        '0',
        coeffsTable,
        aggregates,
        balances,
        positions
      );

      logger.info(`Lender deposits base`);
      await marginlyPool
        .connect(lender)
        .execute(CallType.DepositBase, lenderBaseAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
      await addToLogs(
        sut,
        1,
        longersNum,
        1,
        'Lender depositBase 2',
        lenderBaseAmount.toString(),
        '0',
        coeffsTable,
        aggregates,
        balances,
        positions
      );
    }

    logger.info(`iteration ${i + 1}`);
    let price = (await marginlyPool.getBasePrice()).inner;
    const shorterQuoteDeposit =
      i < 5 ? parseUnits('1', 18).mul(price).div(FP96.one) : parseUnits('2', 18).mul(price).div(FP96.one);
    await (await usdc.connect(treasury).transfer(liquidatedShort.address, shorterQuoteDeposit)).wait();
    await (await usdc.connect(liquidatedShort).approve(marginlyPool.address, shorterQuoteDeposit)).wait();

    logger.info(`  Shorter deposits quote`);
    const shorterShortAmount = i < 5 ? parseUnits('18', 18) : parseUnits('36', 18);
    await marginlyPool
      .connect(liquidatedShort)
      .execute(CallType.DepositQuote, shorterQuoteDeposit, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });

    await addToLogs(
      sut,
      1,
      longersNum,
      1,
      `  Shorter depositQuote ${i}`,
      shorterQuoteDeposit.toString(),
      '0',
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    logger.info(`  Shorter shorts`);
    const shortTx = await (
      await marginlyPool
        .connect(liquidatedShort)
        .execute(CallType.Short, shorterShortAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    const swapPrice = BigNumber.from(shortTx.events?.find((e) => e.event == 'Short')?.args?.swapPriceX96).mul(
      10n ** 12n
    );
    await addToLogs(
      sut,
      1,
      longersNum,
      1,
      `Shorter short ${i}`,
      shorterShortAmount.toString(),
      toHumanString(swapPrice),
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    const longersBaseDeposit = parseUnits('10', 18); // 10 WETH

    const itersNum = i < 5 ? longersNum - 1 : longersNum;
    for (let j = 0; j < itersNum; ++j) {
      await (await weth.connect(treasury).transfer(longers[j].address, longersBaseDeposit)).wait();
      await (await weth.connect(longers[j]).approve(marginlyPool.address, longersBaseDeposit)).wait();
      logger.info(`  Longer_${j} deposits base`);
      await (
        await marginlyPool
          .connect(longers[j])
          .execute(CallType.DepositBase, longersBaseDeposit, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
      ).wait();
      await addToLogs(
        sut,
        1,
        longersNum,
        1,
        `Longer_${j} depositBase ${i}`,
        longersBaseDeposit.toString(),
        '0',
        coeffsTable,
        aggregates,
        balances,
        positions
      );

      logger.info(`  Longer_${j} longs`);
      const price = BigNumber.from((await marginlyPool.getBasePrice()).inner);

      const amount =
        j + 1 != itersNum
          ? longersLongAmount[j]
          : BigNumber.from(await usdc.balanceOf(marginlyPool.address))
              .mul(FP96.one)
              .div(price)
              .mul(999)
              .div(1000);
      const longTx = await (
        await marginlyPool
          .connect(longers[j])
          .execute(CallType.Long, amount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
      ).wait();
      const swapPrice = BigNumber.from(longTx.events?.find((e) => e.event == 'Long')?.args?.swapPriceX96).mul(
        10n ** 12n
      );
      await addToLogs(
        sut,
        1,
        longersNum,
        1,
        `Longer_${j} long ${i}`,
        amount.toString(),
        toHumanString(swapPrice),
        coeffsTable,
        aggregates,
        balances,
        positions
      );
    }

    const baseDelevCoeffBefore = BigNumber.from(await marginlyPool.baseDelevCoeff());
    const quoteDebtCoeffBefore = BigNumber.from(await marginlyPool.quoteDebtCoeff());

    logger.info(`  Toggle liquidation`);

    await marginlyPool.connect(treasury).setParameters(paramsLowLeverage, { gasLimit: 500_000 });

    nextDate += timeDelta;
    await provider.mineAtTimestamp(nextDate);
    await (
      await marginlyPool.connect(treasury).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    await addToLogs(sut, 1, longersNum, 1, `Liquidation ${i}`, '0', '0', coeffsTable, aggregates, balances, positions);

    await marginlyPool.connect(treasury).setParameters(paramsDefaultLeverage, { gasLimit: 500_000 });

    const baseDelevCoeffAfter = BigNumber.from(await marginlyPool.baseDelevCoeff());
    const quoteDebtCoeffAfter = BigNumber.from(await marginlyPool.quoteDebtCoeff());

    assert(!baseDelevCoeffBefore.eq(baseDelevCoeffAfter));
    assert(!quoteDebtCoeffBefore.eq(quoteDebtCoeffAfter));
    logger.info(`  Liquidation happened`);

    for (let j = 0; j < itersNum; ++j) {
      logger.info(`  Longer_${j} closes position`);
      const closePosTx = await (
        await marginlyPool
          .connect(longers[j])
          .execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
      ).wait();
      const swapPrice = BigNumber.from(
        closePosTx.events?.find((e) => e.event == 'ClosePosition')?.args?.swapPriceX96
      ).mul(10n ** 12n);
      await addToLogs(
        sut,
        1,
        longersNum,
        1,
        `Longer_${j} closePosition ${i}`,
        '0',
        toHumanString(swapPrice),
        coeffsTable,
        aggregates,
        balances,
        positions
      );

      logger.info(`  Longer_${j} withdraws all`);
      await marginlyPool
        .connect(longers[j])
        .execute(CallType.WithdrawBase, parseUnits('200000', 18), 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
      await addToLogs(
        sut,
        1,
        longersNum,
        1,
        `Longer_${j} withdrawQuote all ${i}`,
        `0`,
        '0',
        coeffsTable,
        aggregates,
        balances,
        positions
      );
    }
  }
  console.table(coeffsTable);
  console.table(aggregates);
  console.table(balances);
  console.table(positions);
}

export async function deleveragePrecisionShortWithCollateral(sut: SystemUnderTest) {
  const { marginlyPool, usdc, weth, accounts, treasury, provider, uniswap, gasReporter } = sut;

  const coeffsTable: { [key: string]: {} } = {};
  const aggregates: { [key: string]: {} } = {};
  const balances: { [key: string]: {} } = {};
  const positions: { [key: string]: {} } = {};

  // we set interest rate as 0 for this test so we don't need to calculate accrued rate
  // liquidations are approached via decreasing maxLeverage
  await marginlyPool.connect(treasury).setParameters(paramsDefaultLeverage);

  const lender = accounts[0];
  const longer = accounts[1];
  const liquidatedShort = accounts[2];

  const price = (await marginlyPool.getBasePrice()).inner;

  const lenderBaseAmount = parseUnits('18', 18); // 100 WETH
  const lenderQuoteAmount = parseUnits('1', 18).mul(price).div(FP96.one); // USDC equivalent of 1 WETH

  await (await usdc.connect(treasury).transfer(lender.address, lenderQuoteAmount)).wait();
  await (await usdc.connect(lender).approve(marginlyPool.address, lenderQuoteAmount)).wait();

  await (await weth.connect(treasury).transfer(lender.address, lenderBaseAmount)).wait();
  await (await weth.connect(lender).approve(marginlyPool.address, lenderBaseAmount)).wait();

  logger.info(`Lender deposits quote`);
  await marginlyPool
    .connect(lender)
    .execute(CallType.DepositQuote, lenderQuoteAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
  await addToLogs(
    sut,
    1,
    1,
    1,
    'Lender depositQuote 1',
    lenderQuoteAmount.toString(),
    '0',
    coeffsTable,
    aggregates,
    balances,
    positions
  );

  logger.info(`Lender deposits base`);
  await marginlyPool
    .connect(lender)
    .execute(CallType.DepositBase, lenderBaseAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
  await addToLogs(
    sut,
    1,
    1,
    1,
    'Lender depositBase 1',
    lenderBaseAmount.toString(),
    '0',
    coeffsTable,
    aggregates,
    balances,
    positions
  );

  let nextDate = Math.floor(Date.now() / 1000);
  const timeDelta = 24 * 60 * 60;

  for (let i = 0; i < 10; ++i) {
    logger.info(`iteration ${i + 1}`);
    let price = (await marginlyPool.getBasePrice()).inner;
    const shorterQuoteDeposit = parseUnits('1', 18).mul(price).div(FP96.one);
    await (await usdc.connect(treasury).transfer(liquidatedShort.address, shorterQuoteDeposit)).wait();
    await (await usdc.connect(liquidatedShort).approve(marginlyPool.address, shorterQuoteDeposit)).wait();

    logger.info(`  Shorter deposits quote`);
    const shorterShortAmount = parseUnits('18', 18);
    await marginlyPool
      .connect(liquidatedShort)
      .execute(CallType.DepositQuote, shorterQuoteDeposit, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });

    await addToLogs(
      sut,
      1,
      1,
      1,
      `  Shorter depositQuote ${i}`,
      shorterQuoteDeposit.toString(),
      '0',
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    logger.info(`  Shorter shorts`);
    const shortTx = await (
      await marginlyPool
        .connect(liquidatedShort)
        .execute(CallType.Short, shorterShortAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    let swapPrice = BigNumber.from(shortTx.events?.find((e) => e.event == 'Short')?.args?.swapPriceX96).mul(
      10n ** 12n
    );
    await addToLogs(
      sut,
      1,
      1,
      1,
      `Shorter short ${i}`,
      shorterShortAmount.toString(),
      toHumanString(swapPrice),
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    const longersBaseDeposit = parseUnits('1', 18); // 11 WETH

    await (await weth.connect(treasury).transfer(longer.address, longersBaseDeposit)).wait();
    await (await weth.connect(longer).approve(marginlyPool.address, longersBaseDeposit)).wait();
    logger.info(`  Longer deposits base`);
    await (
      await marginlyPool
        .connect(longer)
        .execute(CallType.DepositBase, longersBaseDeposit, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    await addToLogs(
      sut,
      1,
      1,
      1,
      `Longer depositBase ${i}`,
      longersBaseDeposit.toString(),
      '0',
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    logger.info(`  Longer longs`);
    price = BigNumber.from((await marginlyPool.getBasePrice()).inner);
    
    const longAmount = parseUnits('13', 18);
    const longTx = await (
      await marginlyPool
        .connect(longer)
        .execute(CallType.Long, longAmount, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    swapPrice = BigNumber.from(longTx.events?.find((e) => e.event == 'Long')?.args?.swapPriceX96).mul(
      10n ** 12n
    );
    await addToLogs(
      sut,
      1,
      1,
      1,
      `Longer long ${i}`,
      longAmount.toString(),
      toHumanString(swapPrice),
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    const baseDelevCoeffBefore = BigNumber.from(await marginlyPool.baseDelevCoeff());
    const quoteDebtCoeffBefore = BigNumber.from(await marginlyPool.quoteDebtCoeff());

    logger.info(`  Toggle liquidation`);

    await marginlyPool.connect(treasury).setParameters(paramsLowLeverage, { gasLimit: 500_000 });

    nextDate += timeDelta;
    await provider.mineAtTimestamp(nextDate);
    await (
      await marginlyPool.connect(treasury).execute(CallType.Reinit, 0, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    await addToLogs(sut, 1, 1, 1, `Liquidation ${i}`, '0', '0', coeffsTable, aggregates, balances, positions);

    await marginlyPool.connect(treasury).setParameters(paramsDefaultLeverage, { gasLimit: 500_000 });

    const baseDelevCoeffAfter = BigNumber.from(await marginlyPool.baseDelevCoeff());
    const quoteDebtCoeffAfter = BigNumber.from(await marginlyPool.quoteDebtCoeff());

    assert(!baseDelevCoeffBefore.eq(baseDelevCoeffAfter));
    assert(!quoteDebtCoeffBefore.eq(quoteDebtCoeffAfter));
    logger.info(`  Liquidation happened`);

    logger.info(`  Longer closes position`);
    const closePosTx = await (
      await marginlyPool
        .connect(longer)
        .execute(CallType.ClosePosition, 0, 0, false, ZERO_ADDRESS, { gasLimit: 500_000 })
    ).wait();
    swapPrice = BigNumber.from(
      closePosTx.events?.find((e) => e.event == 'ClosePosition')?.args?.swapPriceX96
    ).mul(10n ** 12n);
    await addToLogs(
      sut,
      1,
      1,
      1,
      `Longer closePosition ${i}`,
      '0',
      toHumanString(swapPrice),
      coeffsTable,
      aggregates,
      balances,
      positions
    );

    logger.info(`  Longer withdraws all`);
    await marginlyPool
      .connect(longer)
      .execute(CallType.WithdrawBase, parseUnits('200000', 18), 0, false, ZERO_ADDRESS, { gasLimit: 500_000 });
    await addToLogs(
      sut,
      1,
      1,
      1,
      `Longer withdrawQuote all ${i}`,
      `0`,
      '0',
      coeffsTable,
      aggregates,
      balances,
      positions
    );
  }
  console.table(coeffsTable);
  console.table(aggregates);
  console.table(balances);
  console.table(positions);
}

async function addToLogs(
  sut: SystemUnderTest,
  lendersNum: number,
  longersNum: number,
  shortersNum: number,
  transactionName: string,
  amount: string,
  swapPrice: string,
  coeffsTable: { [key: string]: {} },
  aggregates: { [key: string]: {} },
  balances: { [key: string]: {} },
  positions: { [key: string]: {} }
) {
  const { marginlyPool, usdc, weth, accounts, treasury, provider, uniswap, gasReporter } = sut;
  const lenders = accounts.slice(0, lendersNum);
  const longers = accounts.slice(lendersNum, lendersNum + longersNum);
  const shorters = accounts.slice(lendersNum + longersNum, lendersNum + longersNum + shortersNum);

  const quoteDelevCoeff = BigNumber.from(await marginlyPool.quoteDelevCoeff());
  const baseDebtCoeff = BigNumber.from(await marginlyPool.baseDebtCoeff());
  const quoteCollateralCoeff = BigNumber.from(await marginlyPool.quoteCollateralCoeff());

  const baseDelevCoeff = BigNumber.from(await marginlyPool.baseDelevCoeff());
  const quoteDebtCoeff = BigNumber.from(await marginlyPool.quoteDebtCoeff());
  const baseCollateralCoeff = BigNumber.from(await marginlyPool.baseCollateralCoeff());

  coeffsTable[transactionName] = {
    baseCollateralCoeff: baseCollateralCoeff.toString(),
    baseCollateralCoeffHuman: toHumanString(baseCollateralCoeff),
    baseDelevCoeff: baseDelevCoeff.toString(),
    baseDelevCoeffHuman: toHumanString(baseDelevCoeff),
    baseDebtCoeff: baseDebtCoeff.toString(),
    baseDebtCoeffHuman: toHumanString(baseDebtCoeff),
    quoteCollateralCoeff: quoteCollateralCoeff.toString(),
    quoteCollateralCoeffHuman: toHumanString(quoteCollateralCoeff),
    quoteDelevCoeff: quoteDelevCoeff.toString(),
    quoteDelevCoeffHuman: toHumanString(quoteDelevCoeff),
    quoteDebtCoeff: quoteDebtCoeff.toString(),
    quoteDebtCoeffHuman: toHumanString(quoteDebtCoeff),
  };

  const discountedBaseCollateral = await marginlyPool.discountedBaseCollateral();
  const discountedQuoteDebt = await marginlyPool.discountedQuoteDebt();
  const realBaseCollateral = baseCollateralCoeff
    .mul(discountedBaseCollateral)
    .div(FP96.one)
    .sub(baseDelevCoeff.mul(discountedQuoteDebt).div(FP96.one));
  const realQuoteDebt = quoteDebtCoeff.mul(discountedQuoteDebt).div(FP96.one);

  const discountedBaseDebt = await marginlyPool.discountedBaseDebt();
  const discountedQuoteCollateral = await marginlyPool.discountedQuoteCollateral();
  const realQuoteCollateral = quoteCollateralCoeff
    .mul(discountedQuoteCollateral)
    .div(FP96.one)
    .sub(quoteDelevCoeff.mul(discountedBaseDebt).div(FP96.one));
  const realBaseDebt = baseDebtCoeff.mul(discountedBaseDebt).div(FP96.one);

  aggregates[transactionName] = {
    discountedBaseCollateral: discountedBaseCollateral.toString(),
    realBaseCollateral: realBaseCollateral.toString(),
    discountedBaseDebt: discountedBaseDebt.toString(),
    realBaseDebt: realBaseDebt.toString(),
    discountedQuoteCollateral: discountedQuoteCollateral.toString(),
    realQuoteCollateral: realQuoteCollateral.toString(),
    discountedQuoteDebt: discountedQuoteDebt.toString(),
    realQuoteDebt: realQuoteDebt.toString(),
  };

  const actualWethBalance = formatUnits(await weth.balanceOf(marginlyPool.address), 18);
  const actualUsdcBalance = formatUnits(await usdc.balanceOf(marginlyPool.address), 6);
  const calculatedWethBalance = formatUnits(realBaseCollateral.sub(realBaseDebt), 18);
  const calculatedUsdcBalance = formatUnits(realQuoteCollateral.sub(realQuoteDebt), 6);

  balances[transactionName] = {
    calculatedWethBalance: calculatedWethBalance,
    actualWethBalance: actualWethBalance,
    calculatedUsdcBalance: calculatedUsdcBalance,
    actualUsdcBalance: actualUsdcBalance,
  };

  const positionsInfo = new Map();
  for (let i = 0; i < lendersNum; ++i) {
    const position = await marginlyPool.positions(lenders[i].address);
    const discountedBaseCollateral = position.discountedBaseAmount;
    const discountedQuoteCollateral = position.discountedQuoteAmount;
    const realBaseCollateral = baseCollateralCoeff.mul(discountedBaseCollateral).div(FP96.one);
    const realQuoteCollateral = quoteCollateralCoeff.mul(discountedQuoteCollateral).div(FP96.one);

    positionsInfo.set(`lender_${i} type`, position._type.toString());
    positionsInfo.set(`lender_${i} discountedBaseAmount`, discountedBaseCollateral.toString());
    positionsInfo.set(`lender_${i} realBaseAmount`, realBaseCollateral.toString());
    positionsInfo.set(`lender_${i} discountedQuoteAmount`, discountedQuoteCollateral.toString());
    positionsInfo.set(`lender_${i} realQuoteAmount`, realQuoteCollateral.toString());
  }

  for (let i = 0; i < longersNum; ++i) {
    const position = await marginlyPool.positions(longers[i].address);
    const discountedBaseCollateral = position.discountedBaseAmount;
    const discountedQuoteDebt = position.discountedQuoteAmount;
    const realBaseCollateral = baseCollateralCoeff
      .mul(discountedBaseCollateral)
      .div(FP96.one)
      .sub(baseDelevCoeff.mul(discountedQuoteDebt).div(FP96.one));
    const realQuoteDebt = quoteDebtCoeff.mul(discountedQuoteDebt).div(FP96.one);

    positionsInfo.set(`longer_${i} type`, position._type.toString());
    positionsInfo.set(`longer_${i} discountedBaseAmount`, discountedBaseCollateral.toString());
    positionsInfo.set(`longer_${i} realBaseAmount`, realBaseCollateral.toString());
    positionsInfo.set(`longer_${i} discountedQuoteAmount`, discountedQuoteDebt.toString());
    positionsInfo.set(`longer_${i} realQuoteAmount`, realQuoteDebt.toString());
  }

  for (let i = 0; i < shortersNum; ++i) {
    const position = await marginlyPool.positions(shorters[i].address);
    const discountedBaseDebt = position.discountedBaseAmount;
    const discountedQuoteCollateral = position.discountedQuoteAmount;
    const realQuoteCollateral = quoteCollateralCoeff
      .mul(discountedQuoteCollateral)
      .div(FP96.one)
      .sub(quoteDelevCoeff.mul(discountedBaseDebt).div(FP96.one));
    const realBaseDebt = baseDebtCoeff.mul(discountedBaseDebt).div(FP96.one);

    positionsInfo.set(`shorter_${i} type`, position._type.toString());
    positionsInfo.set(`shorter_${i} discountedBaseAmount`, discountedBaseDebt.toString());
    positionsInfo.set(`shorter_${i} realBaseAmount`, realBaseDebt.toString());
    positionsInfo.set(`shorter_${i} discountedQuoteAmount`, discountedQuoteCollateral.toString());
    positionsInfo.set(`shorter_${i} realQuoteAmount`, realQuoteCollateral.toString());
  }

  positionsInfo.set(`amount`, amount);
  positionsInfo.set(`swapPrice`, swapPrice);

  positions[transactionName] = Object.fromEntries(positionsInfo);
}
