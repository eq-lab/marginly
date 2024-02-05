import { BigNumber } from 'ethers';
import { task, types } from 'hardhat/config';
import { Network, TaskArguments } from 'hardhat/types';

type MarginlyParameters = {
  maxLeverage: number;
  priceSecondsAgo: number;
  priceSecondsAgoMC: number;
  interestRate: number;
  fee: number;
  swapFee: number;
  mcSlippage: number;
  positionMinAmount: BigNumber;
  quoteLimit: BigNumber;
};

// Example: npx hardhat pool:setParameters --network arbitrumSepolia --signer "" --marginlypool "" --maxleverage 20

task('pool:setParameters')
  .addParam('signer', 'The signer private key.')
  .addParam('marginlypool', 'Address of marginly pool.')
  .addOptionalParam('maxleverage', ' Maximum allowable leverage in the Regular mode.')
  .addOptionalParam(
    'pricesecondsago',
    'Number of seconds in the past from which to calculate the time-weighted-average-price'
  )
  .addOptionalParam(
    'pricesecondsagomc',
    'Number of seconds in the past from which to calculate the time-weighted-average-price for swaps in MC'
  )
  .addOptionalParam('interestrate', 'Interest rate. Example 1% = 10000')
  .addOptionalParam('fee', ' Close debt fee. 1% = 10000')
  .addOptionalParam(
    'swapfee',
    'Pool fee. When users take leverage they pay `swapFee` on the notional borrow amount. 1% = 10000'
  )
  .addOptionalParam('mcslippage', 'Max slippage when margin call')
  .addOptionalParam('positionminamount', 'Min amount of base token to open short/long position')
  .addOptionalParam('quoteLimit', 'Max amount of quote token in system')
  .setAction(async function (args: TaskArguments, hre) {
    const provider = new hre.ethers.providers.JsonRpcProvider((hre.network.config as any).url);
    const signer = new hre.ethers.Wallet(args.signer, provider);

    const factory = await hre.ethers.getContractFactory('MarginlyPool', signer);
    const marginlyPool = factory.attach(args.marginlypool);

    const parameters: MarginlyParameters = await marginlyPool.params();
    const updatedParameters: MarginlyParameters = {
      maxLeverage: parameters.maxLeverage,
      priceSecondsAgo: parameters.priceSecondsAgo,
      priceSecondsAgoMC: parameters.priceSecondsAgoMC,
      interestRate: parameters.interestRate,
      fee: parameters.fee,
      swapFee: parameters.swapFee,
      mcSlippage: parameters.mcSlippage,
      positionMinAmount: parameters.positionMinAmount,
      quoteLimit: parameters.quoteLimit,
    };

    if (args.maxleverage) {
      const maxLeverage: number = Number.parseInt(args.maxleverage);
      if (maxLeverage < 2 || maxLeverage > 100) {
        throw new Error(`Wrong maxLeverage value ${args.maxleverage}`);
      }

      updatedParameters.maxLeverage = maxLeverage;
    }

    if (args.pricesecondsago) {
      const priceSecondsAgo = Number.parseInt(args.pricesecondsago);
      if (priceSecondsAgo <= 0) {
        throw new Error(`Wrong priceSecondsAgo value ${args.pricesecondsago}`);
      }

      updatedParameters.priceSecondsAgo = priceSecondsAgo;
    }

    if (args.pricesecondsagomc) {
      const priceSecondsAgoMC = Number.parseInt(args.pricesecondsagomc);
      if (priceSecondsAgoMC <= 0) {
        throw new Error(`Wrong priceSecondsAgoMC value ${args.pricesecondsagomc}`);
      }

      updatedParameters.priceSecondsAgoMC = priceSecondsAgoMC;
    }

    if (args.interestrate) {
      const interestRate = Number.parseInt(args.interestrate);
      if (interestRate < 0 || interestRate > 1_000_000) {
        throw new Error(`Wrong interestRate value ${args.interestrate}`);
      }

      updatedParameters.interestRate = interestRate;
    }

    if (args.fee) {
      const fee = Number.parseInt(args.fee);
      if (fee < 0 || fee > 1_000_000) {
        throw new Error(`Wrong fee value ${args.fee}`);
      }

      updatedParameters.fee = fee;
    }

    if (args.swapfee) {
      const swapfee = Number.parseInt(args.swapfee);
      if (swapfee < 0 || swapfee > 1_000_000) {
        throw new Error(`Wrong swapfee value ${args.swapfee}`);
      }

      updatedParameters.swapFee = swapfee;
    }

    if (args.mcslippage) {
      const mcslippage = Number.parseInt(args.mcslippage);
      if (mcslippage < 0 || mcslippage > 1_000_000) {
        throw new Error(`Wrong mcslippage value ${args.mcslippage}`);
      }

      updatedParameters.mcSlippage = mcslippage;
    }

    if (args.positionminamount) {
      const positionminamount = BigNumber.from(args.positionminamount);
      if (positionminamount.lte(0)) {
        throw new Error(`Wrong positionminamount value ${args.positionminamount}`);
      }

      updatedParameters.positionMinAmount = positionminamount;
    }

    if (args.quoteLimit) {
      const quoteLimit = BigNumber.from(args.quoteLimit);
      if (quoteLimit.lte(0)) {
        throw new Error(`Wrong positionminamount value ${args.quoteLimit}`);
      }

      updatedParameters.quoteLimit = quoteLimit;
    }

    const tx = await marginlyPool.setParameters(updatedParameters);
    await tx.wait();

    console.log(`MarginlyPool ${marginlyPool.address} parameters updated`);
    console.log(`Old paramters: `);
    console.log(parameters);
    console.log(`New parameters: `);
    console.log(updatedParameters);
  });
