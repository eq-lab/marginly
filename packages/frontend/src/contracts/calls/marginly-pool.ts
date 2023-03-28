import { ContractMethodDescription } from './index';
import { BigNumber, ethers } from 'ethers';
import { getBaseTokenContract, getPosition, getQuoteTokenContract, PositionType } from '../common';
import { sendTransaction } from './common';
import { ContractsParams } from '../../connection';
import { parseUnits } from 'ethers/lib/utils';

const longCall: ContractMethodDescription = {
  methodName: 'long',
  argsNames: ['base amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 1) {
      console.error(`longCall: invalid count of args`);
      return;
    }
    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await baseTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);

    await sendTransaction(contract, signer, 'long', [amount.toString()], gasLimit, gasPrice);
  },
};

const shortCall: ContractMethodDescription = {
  methodName: 'short',
  argsNames: ['base amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 1) {
      console.error(`shortCall: invalid count of args`);
      return;
    }

    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await baseTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);
    await sendTransaction(contract, signer, 'short', [amount.toString()], gasLimit, gasPrice);
  },
};

const depositBaseCall: ContractMethodDescription = {
  methodName: 'depositBase',
  argsNames: ['amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 1) {
      console.error(`depositBaseCall: invalid count of args`);
      return;
    }
    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await baseTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);
    const signerAddress = await signer.getAddress();
    const balance = BigNumber.from(await baseTokenContract.balanceOf(await signer.getAddress()));
    const allowance = BigNumber.from(await baseTokenContract.allowance(signerAddress, contract.address));
    const symbol = await baseTokenContract.symbol();
    if (amount.gt(balance)) {
      console.error(
        `depositBaseCall: insufficient base token balance! ` +
          `Balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}, ` +
          `transfer amount: ${ethers.utils.formatUnits(amount, decimals)} ${symbol}`
      );
      return;
    }
    if (amount.gt(allowance)) {
      console.error(
        `depositBaseCall: base token allowance it too low! ` +
          `Allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}, ` +
          `transfer amount: ${ethers.utils.formatUnits(amount, decimals)} ${symbol}`
      );
      return;
    }
    await sendTransaction(contract, signer, 'depositBase', [amount.toString()], gasLimit, gasPrice);
  },
};

const depositQuoteCall: ContractMethodDescription = {
  methodName: 'depositQuote',
  argsNames: ['amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 1) {
      console.error(`depositQuoteCall: invalid count of args`);
      return;
    }
    const quoteTokenContract = await getQuoteTokenContract(contract);
    const decimals = await quoteTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);
    const signerAddress = await signer.getAddress();
    const balance = BigNumber.from(await quoteTokenContract.balanceOf(signerAddress));
    const allowance = BigNumber.from(await quoteTokenContract.allowance(signerAddress, contract.address));
    const symbol = await quoteTokenContract.symbol();
    if (amount.gt(balance)) {
      console.error(
        `depositQuoteCall: insufficient quote token balance! ` +
          `Balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}, ` +
          `transfer amount: ${ethers.utils.formatUnits(amount, decimals)} ${symbol}`
      );
      return;
    }
    if (amount.gt(allowance)) {
      console.error(
        `depositQuoteCall: quote token allowance it too low! ` +
          `Allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}, ` +
          `transfer amount: ${ethers.utils.formatUnits(amount, decimals)} ${symbol}`
      );
      return;
    }
    await sendTransaction(contract, signer, 'depositQuote', [amount.toString()], gasLimit, gasPrice);
  },
};

const withdrawQuoteCall: ContractMethodDescription = {
  methodName: 'withdrawQuote',
  argsNames: ['amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 1) {
      console.error(`withdrawQuoteCall: invalid count of args`);
      return;
    }
    const quoteTokenContract = await getQuoteTokenContract(contract);
    const decimals = await quoteTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);

    if (amount.isZero()) {
      console.error(`withdrawQuoteCall: zero amount`);
    }
    await sendTransaction(contract, signer, 'withdrawQuote', [amount.toString()], gasLimit, gasPrice);
  },
};

const withdrawBaseCall: ContractMethodDescription = {
  methodName: 'withdrawBase',
  argsNames: ['amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 1) {
      console.error(`withdrawBaseCall: invalid count of args`);
      return;
    }
    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await baseTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);

    if (amount.isZero()) {
      console.error(`withdrawBaseCall: zero amount`);
    }
    await sendTransaction(contract, signer, 'withdrawBase', [amount.toString()], gasLimit, gasPrice);
  },
};

const closePositionCall: ContractMethodDescription = {
  methodName: 'closePosition',
  argsNames: [],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    const signerAddress = await signer.getAddress();
    const position = await getPosition(contract, signerAddress);

    if (position.type === PositionType.Uninitialized) {
      console.error(`closePositionCall: position is uninitialized`);
      return;
    }
    if (position.type === PositionType.Lend) {
      console.error(`closePositionCall: Lend position, nothing to close`);
      return;
    }
    await sendTransaction(contract, signer, 'closePosition', [], gasLimit, gasPrice);
  },
};

const increaseBaseCollateralCoeffCall: ContractMethodDescription = {
  methodName: 'increaseBaseCollateralCoeff',
  argsNames: ['amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 1) {
      console.error(`increaseBaseCollateralCoeffCall: invalid count of args`);
      return;
    }

    const discountedBaseCollateral = BigNumber.from(await contract.discountedBaseCollateral());
    if (discountedBaseCollateral.isZero()) {
      console.error(`increaseBaseCollateralCoeffCall: discountedBaseCollateral must be not zero`);
      return;
    }

    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await baseTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);
    const signerAddress = await signer.getAddress();
    const balance = BigNumber.from(await baseTokenContract.balanceOf(await signer.getAddress()));
    const allowance = BigNumber.from(await baseTokenContract.allowance(signerAddress, contract.address));
    const symbol = await baseTokenContract.symbol();
    if (amount.gt(balance)) {
      console.error(
        `increaseBaseCollateralCoeffCall: insufficient base token balance! ` +
          `Balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}, ` +
          `transfer amount: ${ethers.utils.formatUnits(amount, decimals)} ${symbol}`
      );
      return;
    }
    if (amount.gt(allowance)) {
      console.error(
        `increaseBaseCollateralCoeffCall: base token allowance it too low! ` +
          `Allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}, ` +
          `transfer amount: ${ethers.utils.formatUnits(amount, decimals)} ${symbol}`
      );
      return;
    }
    await sendTransaction(contract, signer, 'increaseBaseCollateralCoeff', [amount.toString()], gasLimit, gasPrice);
  },
};

const increaseQuoteCollateralCoeffCall: ContractMethodDescription = {
  methodName: 'increaseQuoteCollateralCoeff',
  argsNames: ['amount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 1) {
      console.error(`increaseQuoteCollateralCoeffCall: invalid count of args`);
      return;
    }

    const discountedQuoteCollateral = BigNumber.from(await contract.discountedQuoteCollateral());
    if (discountedQuoteCollateral.isZero()) {
      console.error(`increaseQuoteCollateralCoeffCall: discountedQuoteCollateral must be not zero`);
      return;
    }

    const quoteTokenContract = await getQuoteTokenContract(contract);
    const decimals = await quoteTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);
    const signerAddress = await signer.getAddress();
    const balance = BigNumber.from(await quoteTokenContract.balanceOf(await signer.getAddress()));
    const allowance = BigNumber.from(await quoteTokenContract.allowance(signerAddress, contract.address));
    const symbol = await quoteTokenContract.symbol();
    if (amount.gt(balance)) {
      console.error(
        `increaseQuoteCollateralCoeffCall: insufficient quote token balance! ` +
          `Balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}, ` +
          `transfer amount: ${ethers.utils.formatUnits(amount, decimals)} ${symbol}`
      );
      return;
    }
    if (amount.gt(allowance)) {
      console.error(
        `increaseQuoteCollateralCoeffCall: quote token allowance it too low! ` +
          `Allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}, ` +
          `transfer amount: ${ethers.utils.formatUnits(amount, decimals)} ${symbol}`
      );
      return;
    }
    await sendTransaction(contract, signer, 'increaseQuoteCollateralCoeff', [amount.toString()], gasLimit, gasPrice);
  },
};

const reinitCall: ContractMethodDescription = {
  methodName: 'reinit',
  argsNames: [],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    await sendTransaction(contract, signer, 'reinit', args, gasLimit, gasPrice);
  },
};

const setParametersCall: ContractMethodDescription = {
  methodName: 'setParameters(onlyOwner)',
  argsNames: [
    'maxLeverage',
    'recoveryMaxLeverage',
    'priceSecondsAgo',
    'interestRate',
    'swapFee',
    'positionSlippage',
    'mcSlippage',
    'positionMinAmount',
  ],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 8) {
      console.error(`setParametersCall: invalid count of args`);
      return;
    }

    await sendTransaction(contract, signer, 'setParameters', args, gasLimit, gasPrice);
  },
};

const receivePositionCall: ContractMethodDescription = {
  methodName: 'receivePosition',
  argsNames: ['address', 'quoteAmount', 'baseAmount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 3) {
      console.error(`receivePosition: invalid count of args`);
      return;
    }
    const address = args[0];

    const [quoteDecimals, baseDecimals] = await Promise.all([
      contractsContext.quoteTokenContract.decimals(),
      contractsContext.baseTokenContract.decimals(),
    ]);

    const quoteAmount = parseUnits(args[1], quoteDecimals);
    const baseAmount = parseUnits(args[2], baseDecimals);

    await sendTransaction(
      contract,
      signer,
      'receivePosition',
      [address, quoteAmount.toString(), baseAmount.toString()],
      gasLimit,
      gasPrice
    );
  },
};

const shutDownCall: ContractMethodDescription = {
  methodName: 'shutdown (onlyOwner)',
  argsNames: [],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 0) {
      console.error(`shutdown: invalid count of args`);
      return;
    }

    await sendTransaction(contract, signer, 'shutDown', [], gasLimit, gasPrice);
  },
};

const emergencyWithdraw: ContractMethodDescription = {
  methodName: 'emergencyWithdraw',
  argsNames: [],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 0) {
      console.error(`emergencyWithdraw: invalid count of args`);
      return;
    }

    await sendTransaction(contract, signer, 'emergencyWithdraw', [], gasLimit, gasPrice);
  },
};

export const marginlyPoolMethods = [
  reinitCall,
  depositBaseCall,
  depositQuoteCall,

  longCall,
  shortCall,

  withdrawQuoteCall,
  withdrawBaseCall,

  closePositionCall,
  setParametersCall,

  increaseBaseCollateralCoeffCall,
  increaseQuoteCollateralCoeffCall,

  receivePositionCall,
  shutDownCall,
  emergencyWithdraw,
];
