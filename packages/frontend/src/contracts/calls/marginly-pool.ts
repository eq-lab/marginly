import { ContractMethodDescription } from './index';
import { BigNumber, ethers } from 'ethers';
import { getBaseTokenContract, getPosition, getQuoteTokenContract, PositionType } from '../common';
import { sendTransaction } from './common';
import { ContractsParams } from '../../connection';
import { parseUnits } from 'ethers/lib/utils';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const CallType = {
  DepositBase: 0,
  DepositQuote: 1,
  WithdrawBase: 2,
  WithdrawQuote: 3,
  Short: 4,
  Long: 5,
  ClosePosition: 6,
  Reinit: 7,
  ReceivePosition: 8,
  EmergencyWithdraw: 9,
};

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

    await sendTransaction(
      contract,
      signer,
      'execute',
      [CallType.Long.toString(), amount.toString(), '0', 'false', ZERO_ADDRESS],
      gasLimit,
      gasPrice
    );
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
    await sendTransaction(
      contract,
      signer,
      'execute',
      [CallType.Short.toString(), amount.toString(), '0', 'false', ZERO_ADDRESS],
      gasLimit,
      gasPrice
    );
  },
};

const depositBaseNativeCall: ContractMethodDescription = {
  methodName: 'depositBaseETH',
  argsNames: ['amountETH', 'longAmount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 2) {
      console.error(`depositBaseCall: invalid count of args`);
      return;
    }
    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await baseTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);
    const longAmount = ethers.utils.parseUnits(args[1], decimals);

    await sendTransaction(
      contract,
      signer,
      'execute',
      [CallType.DepositBase.toString(), amount.toString(), longAmount.toString(), 'false', ZERO_ADDRESS],
      gasLimit,
      gasPrice,
      amount.toString()
    );
  },
};

const depositBaseCall: ContractMethodDescription = {
  methodName: 'depositBase',
  argsNames: ['amount', 'longAmount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 2) {
      console.error(`depositBaseCall: invalid count of args`);
      return;
    }
    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await baseTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);
    const longAmount = ethers.utils.parseUnits(args[1], decimals);
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
    await sendTransaction(
      contract,
      signer,
      'execute',
      [CallType.DepositBase.toString(), amount.toString(), longAmount.toString(), 'false', ZERO_ADDRESS],
      gasLimit,
      gasPrice
    );
  },
};

const depositQuoteNativeCall: ContractMethodDescription = {
  methodName: 'depositQuoteETH',
  argsNames: ['amountETH', 'shortAmount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 2) {
      console.error(`depositQuoteNativeCall: invalid count of args`);
      return;
    }
    const quoteTokenContract = await getQuoteTokenContract(contract);
    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await quoteTokenContract.decimals();
    const baseDecimals = await baseTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);
    const shortAmount = ethers.utils.parseUnits(args[1], baseDecimals);

    await sendTransaction(
      contract,
      signer,
      'execute',
      [CallType.DepositQuote.toString(), amount.toString(), shortAmount.toString(), 'false', ZERO_ADDRESS],
      gasLimit,
      gasPrice,
      amount.toString()
    );
  },
};

const depositQuoteCall: ContractMethodDescription = {
  methodName: 'depositQuote',
  argsNames: ['amount', 'shortAmount'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 2) {
      console.error(`depositQuoteCall: invalid count of args`);
      return;
    }
    const quoteTokenContract = await getQuoteTokenContract(contract);
    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await quoteTokenContract.decimals();
    const baseDecimals = await baseTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);
    const shortAmount = ethers.utils.parseUnits(args[1], baseDecimals);
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
    await sendTransaction(
      contract,
      signer,
      'execute',
      [CallType.DepositQuote.toString(), amount.toString(), shortAmount.toString(), 'false', ZERO_ADDRESS],
      gasLimit,
      gasPrice
    );
  },
};

const withdrawQuoteCall: ContractMethodDescription = {
  methodName: 'withdrawQuote',
  argsNames: ['amount', 'unwrapETH'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 2) {
      console.error(`withdrawQuoteCall: invalid count of args`);
      return;
    }
    const quoteTokenContract = await getQuoteTokenContract(contract);
    const decimals = await quoteTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);
    const unwrapETH = args[1] === 'true';

    if (amount.isZero()) {
      console.error(`withdrawQuoteCall: zero amount`);
    }
    await sendTransaction(
      contract,
      signer,
      'execute',
      [CallType.WithdrawQuote.toString(), amount.toString(), '0', unwrapETH.toString(), ZERO_ADDRESS],
      gasLimit,
      gasPrice
    );
  },
};

const withdrawBaseCall: ContractMethodDescription = {
  methodName: 'withdrawBase',
  argsNames: ['amount', 'unwrapETH'],
  callHandler: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    gasLimit: number,
    gasPrice: number,
    _contractsContext: ContractsParams
  ): Promise<void> => {
    if (args.length !== 2) {
      console.error(`withdrawBaseCall: invalid count of args`);
      return;
    }
    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await baseTokenContract.decimals();
    const amount = ethers.utils.parseUnits(args[0], decimals);
    const unwrapETH = args[1] === 'true';

    if (amount.isZero()) {
      console.error(`withdrawBaseCall: zero amount`);
    }
    await sendTransaction(
      contract,
      signer,
      'execute',
      [CallType.WithdrawBase.toString(), amount.toString(), '0', unwrapETH.toString(), ZERO_ADDRESS],
      gasLimit,
      gasPrice
    );
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
    await sendTransaction(
      contract,
      signer,
      'execute',
      [CallType.ClosePosition.toString(), '0', '0', 'false', ZERO_ADDRESS],
      gasLimit,
      gasPrice
    );
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
    await sendTransaction(
      contract,
      signer,
      'execute',
      [CallType.Reinit.toString(), '0', '0', 'false', ZERO_ADDRESS],
      gasLimit,
      gasPrice
    );
  },
};

const setParametersCall: ContractMethodDescription = {
  methodName: 'setParameters(onlyOwner)',
  argsNames: [
    'maxLeverage',
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
      'execute',
      [CallType.ReceivePosition.toString(), quoteAmount.toString(), baseAmount.toString(), 'false', address],
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

    await sendTransaction(
      contract,
      signer,
      'execute',
      [CallType.EmergencyWithdraw.toString(), '0', '0', 'false', ZERO_ADDRESS],
      gasLimit,
      gasPrice
    );
  },
};

export const marginlyPoolMethods = [
  reinitCall,
  depositBaseCall,
  depositQuoteCall,

  depositBaseNativeCall,
  depositQuoteNativeCall,

  longCall,
  shortCall,

  withdrawQuoteCall,
  withdrawBaseCall,

  closePositionCall,
  setParametersCall,

  receivePositionCall,
  shutDownCall,
  emergencyWithdraw,
];
