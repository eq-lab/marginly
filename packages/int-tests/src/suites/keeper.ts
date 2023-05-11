import { BigNumber, BigNumberish } from 'ethers';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SystemUnderTest } from '.';
import { MarginlyPoolContract } from '../contract-api/MarginlyPool';
import { logger } from '../utils/logger';

type PoolCoeffs = {
  baseCollateralCoeffX96: BigNumber;
  baseDebtCoeffX96: BigNumber;
  quoteCollateralCoeffX96: BigNumber;
  quoteDebtCoeffX96: BigNumber;
};

async function getDebtAmount(
  marginlyPool: MarginlyPoolContract,
  positionAddress: string,
  basePriceX96: BigNumber,
  poolCoeffs: PoolCoeffs
): Promise<BigNumber> {
  const Fp96One = BigNumber.from(2).pow(96);
  const position = await marginlyPool.positions(positionAddress);

  if (position._type == 2) {
    const debt = BigNumber.from(position.discountedBaseAmount).mul(poolCoeffs.baseDebtCoeffX96).div(Fp96One);
    const debtInQuote = debt.mul(basePriceX96).div(Fp96One);
    const collateral = BigNumber.from(position.discountedQuoteAmount)
      .mul(poolCoeffs.quoteCollateralCoeffX96)
      .div(Fp96One);

    const leverage = collateral.div(collateral.sub(debtInQuote));
    console.log(`Position ${positionAddress} leverage is ${leverage}`);
    return debt;
  } else if (position._type == 3) {
    const debt = BigNumber.from(position.discountedQuoteAmount).mul(poolCoeffs.quoteDebtCoeffX96).div(Fp96One);
    const collateral = BigNumber.from(position.discountedBaseAmount)
      .mul(poolCoeffs.baseCollateralCoeffX96)
      .div(Fp96One);
    const collateralInQuote = collateral.mul(basePriceX96).div(Fp96One);

    const leverage = collateralInQuote.div(collateralInQuote.sub(debt));
    console.log(`Position ${positionAddress} leverage is ${leverage}`);
    return debt;
  } else {
    throw Error('Wrong position type');
  }
}

export async function keeper(sut: SystemUnderTest) {
  logger.info(`Starting keeper liquidation test suite`);
  const ethArgs = { gasLimit: 1_000_000 };

  const { marginlyPool, keeper, treasury, usdc, weth, accounts, provider, uniswap, gasReporter } = sut;

  const lender = accounts[0];
  logger.info(`Deposit lender account`);
  {
    const quoteAmount = parseUnits('1000000', 6); // 1_000_000 USDC
    const baseAmount = parseUnits('20', 18); // 20 WETH

    await (await usdc.connect(treasury).transfer(lender.address, quoteAmount)).wait();
    await (await usdc.connect(lender).approve(marginlyPool.address, quoteAmount)).wait();

    await (await weth.connect(treasury).transfer(lender.address, baseAmount)).wait();
    await (await weth.connect(lender).approve(marginlyPool.address, baseAmount)).wait();

    await marginlyPool.connect(lender).depositBase(baseAmount, 0, ethArgs);
    await marginlyPool.connect(lender).depositQuote(quoteAmount, 0, ethArgs);
  }

  const longer = accounts[1];
  logger.info(`Deposit longer account`);
  {
    const baseAmount = parseUnits('1', 18); // 0.1 WETH
    const longAmount = parseUnits('17', 18); //1.7 WETH

    await (await weth.connect(treasury).transfer(longer.address, baseAmount)).wait();
    await (await weth.connect(longer).approve(marginlyPool.address, baseAmount)).wait();

    await (await marginlyPool.connect(longer).depositBase(baseAmount, 0, ethArgs)).wait();
    await (await marginlyPool.connect(longer).long(longAmount, ethArgs)).wait();
  }

  logger.info(`Deposit shorter account`);
  const shorter = accounts[2];
  {
    const quoteAmount = parseUnits('200', 6); // 200 USDC
    const shortAmount = parseUnits('1.7', 18); // 1.7 WETH
    await (await usdc.connect(treasury).transfer(shorter.address, quoteAmount)).wait();
    await (await usdc.connect(shorter).approve(marginlyPool.address, quoteAmount)).wait();

    await (await marginlyPool.connect(shorter).depositQuote(quoteAmount, 0, ethArgs)).wait();
    await (await marginlyPool.connect(shorter).short(shortAmount, ethArgs)).wait();
  }

  // Set parameters to leverage 17
  {
    const params = await marginlyPool.params();
    await (await marginlyPool.connect(treasury).setParameters({ ...params, maxLeverage: 17 })).wait();
  }

  const [basePrice, params, baseCollateralCoeff, baseDebtCoeff, quoteCollateralCoeff, quoteDebtCoeff]: [
    any,
    any,
    BigNumberish,
    BigNumberish,
    BigNumberish,
    BigNumberish
  ] = await Promise.all([
    marginlyPool.getBasePrice(),
    marginlyPool.params(),
    marginlyPool.baseCollateralCoeff(),
    marginlyPool.baseDebtCoeff(),
    marginlyPool.quoteCollateralCoeff(),
    marginlyPool.quoteDebtCoeff(),
  ]);

  const basePriceX96 = BigNumber.from(basePrice.inner);
  const maxLeverage = BigNumber.from(params.maxLeverage);

  console.log(`Max leverage is ${maxLeverage}`);

  const poolCoeffs: PoolCoeffs = {
    baseCollateralCoeffX96: BigNumber.from(baseCollateralCoeff),
    baseDebtCoeffX96: BigNumber.from(baseDebtCoeff),
    quoteCollateralCoeffX96: BigNumber.from(quoteCollateralCoeff),
    quoteDebtCoeffX96: BigNumber.from(quoteDebtCoeff),
  };

  const longerDebtAmount = await getDebtAmount(marginlyPool, longer.address, basePriceX96, poolCoeffs);
  const shorterDebtAmount = await getDebtAmount(marginlyPool, shorter.address, basePriceX96, poolCoeffs);

  const liquidator = accounts[4];

  let balanceBefore = BigNumber.from(await usdc.balanceOf(liquidator.address));

  await gasReporter.saveGasUsage(
    'keeper.flashLoan',
    keeper.connect(liquidator).flashLoan(usdc.address, longerDebtAmount, 0, marginlyPool.address, longer.address, 0)
  );

  let balanceAfter = BigNumber.from(await usdc.balanceOf(liquidator.address));

  let profit = formatUnits(balanceAfter.sub(balanceBefore), await usdc.decimals());
  console.log(`Profit after long position liquidation is ${profit} USDC`);

  balanceBefore = BigNumber.from(await weth.balanceOf(liquidator.address));
  await gasReporter.saveGasUsage(
    'keeper.flashLoan',
    keeper.connect(liquidator).flashLoan(weth.address, shorterDebtAmount, 0, marginlyPool.address, shorter.address, 0)
  );

  balanceAfter = BigNumber.from(await weth.balanceOf(liquidator.address));
  profit = formatUnits(balanceAfter.sub(balanceBefore), await weth.decimals());
  console.log(`Profit after short position liquidation is ${profit} WETH`);
}
