import { ContractStateDescription } from './index';
import { BigNumber, ethers } from 'ethers';
import {
  FP96,
  getBaseTokenContract,
  getPosition,
  getQuoteTokenContract,
  positionEnumToStr,
  PositionType,
  toHumanString,
} from '../common';
import { ContractsParams } from '../../connection';

const signerEthBalanceState: ContractStateDescription = {
  stateName: 'signerEthBalance',
  valueUnits: 'ETH',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const balance = await contract.provider.getBalance(await signer.getAddress());
    return [ethers.utils.formatEther(balance)];
  },
};

const signerQuoteBalanceState: ContractStateDescription = {
  stateName: 'signerQuoteBalance',
  valueUnits: 'Tokens',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const quoteTokenContract = await getQuoteTokenContract(contract);
    const decimals = await quoteTokenContract.decimals();
    const balance = await quoteTokenContract.balanceOf(await signer.getAddress());
    const symbol = await quoteTokenContract.symbol();
    return [ethers.utils.formatUnits(balance, decimals) + ' ' + symbol];
  },
};

const signerBaseBalanceState: ContractStateDescription = {
  stateName: 'signerBaseBalance',
  valueUnits: 'Tokens',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await baseTokenContract.decimals();
    const balance = await baseTokenContract.balanceOf(await signer.getAddress());
    const symbol = await baseTokenContract.symbol();
    return [ethers.utils.formatUnits(balance, decimals) + ' ' + symbol];
  },
};

const feeHolderState: ContractStateDescription = {
  stateName: 'feeHolder',
  valueUnits: 'Address',
  argsNames: [],
  fetchValue: async (
    _contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    contractsContext: ContractsParams
  ): Promise<string[]> => {
    return [await contractsContext.marginlyFactoryContract.feeHolder()];
  },
};

const feeHolderQuoteBalanceState: ContractStateDescription = {
  stateName: 'feeHolder balance',
  valueUnits: 'Tokens',
  argsNames: [],
  fetchValue: async (
    _contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    contractsContext: ContractsParams
  ): Promise<string[]> => {
    const feeHolderAddress = await contractsContext.marginlyFactoryContract.feeHolder();
    const [balance, decimals, symbol] = await Promise.all([
      contractsContext.quoteTokenContract.balanceOf(feeHolderAddress),
      contractsContext.quoteTokenContract.decimals(),
      contractsContext.quoteTokenContract.symbol(),
    ]);
    return [ethers.utils.formatUnits(balance, decimals) + ' ' + symbol];
  },
};

type MarginlyParams = {
  maxLeverage: number;
  recoveryMaxLeverage: number;
  interestRate: BigNumber;
  swapFee: BigNumber;
  priceSecondsAgo: number;
  positionSlippage: BigNumber;
  mcSlippage: BigNumber;
  positionMinAmount: BigNumber;
};

async function getMarginlyParams(poolContract: ethers.Contract): Promise<MarginlyParams> {
  const [
    maxLeverage,
    recoveryMaxLeverage,
    priceSecondsAgo,
    interestRate,
    swapFee,
    positionSlippage,
    mcSlippage,
    positionMinAmount,
  ] = await poolContract.params();
  return {
    maxLeverage,
    recoveryMaxLeverage,
    interestRate,
    swapFee,
    priceSecondsAgo,
    positionSlippage,
    mcSlippage,
    positionMinAmount,
  };
}

const paramsMaxLeverageState: ContractStateDescription = {
  stateName: 'params.maxLeverage',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const params = await getMarginlyParams(contract);
    return [params.maxLeverage.toString()];
  },
};

const paramsRecoveryMaxLeverageState: ContractStateDescription = {
  stateName: 'params.recoveryMaxLeverage',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const params = await getMarginlyParams(contract);
    return [params.recoveryMaxLeverage.toString()];
  },
};

const paramsInterestRateState: ContractStateDescription = {
  stateName: 'params.interestRate',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const params = await getMarginlyParams(contract);
    return [(+params.interestRate / 1e6).toString()];
  },
};

const paramsSwapFeeState: ContractStateDescription = {
  stateName: 'params.swapFee',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const params = await getMarginlyParams(contract);
    return [(+params.swapFee / 1e6).toString()];
  },
};

const paramsPriceSecondsAgoState: ContractStateDescription = {
  stateName: 'params.priceSecondsAgo',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const params = await getMarginlyParams(contract);
    return [params.priceSecondsAgo.toString()];
  },
};

const paramsPositionMinAmountState: ContractStateDescription = {
  stateName: 'params.positionMinAmount',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const params = await getMarginlyParams(contract);
    return [params.positionMinAmount.toString()];
  },
};

const paramsPositionSlippageState: ContractStateDescription = {
  stateName: 'params.positionSlippage',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const params = await getMarginlyParams(contract);
    return [(+params.positionSlippage / 1e6).toString()];
  },
};

const paramsMcSlippageState: ContractStateDescription = {
  stateName: 'params.mcSlippage',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const params = await getMarginlyParams(contract);
    return [(+params.mcSlippage / 1e6).toString()];
  },
};

const discountedQuoteCollateralState: ContractStateDescription = {
  stateName: 'discountedQuoteCollateral',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const discountedQuoteCollateral = BigNumber.from(await contract.discountedQuoteCollateral());
    return [discountedQuoteCollateral.toString()];
  },
};

const discountedQuoteDebtState: ContractStateDescription = {
  stateName: 'discountedQuoteDebt',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const discountedQuoteDebt = BigNumber.from(await contract.discountedQuoteDebt());
    return [discountedQuoteDebt.toString()];
  },
};

const discountedBaseCollateralState: ContractStateDescription = {
  stateName: 'discountedBaseCollateral',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const discountedBaseCollateral = BigNumber.from(await contract.discountedBaseCollateral());
    return [discountedBaseCollateral.toString()];
  },
};

const discountedBaseDebtState: ContractStateDescription = {
  stateName: 'discountedBaseDebt',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const discountedBaseDebt = BigNumber.from(await contract.discountedBaseDebt());
    return [discountedBaseDebt.toString()];
  },
};

const lastReinitTimestampSecondsState: ContractStateDescription = {
  stateName: 'lastReinitTimestampSeconds',
  valueUnits: 'seconds',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const lastReinitTimestampSeconds = BigNumber.from(await contract.lastReinitTimestampSeconds());
    return [lastReinitTimestampSeconds.toString()];
  },
};

const baseCollateralCoeffState: ContractStateDescription = {
  stateName: 'baseCollateralCoeff',
  valueUnits: 'decimal',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const baseCollateralCoeff = BigNumber.from(await contract.baseCollateralCoeff());
    return [toHumanString(baseCollateralCoeff)];
  },
};

const baseDebtCoeffState: ContractStateDescription = {
  stateName: 'baseDebtCoeff',
  valueUnits: 'decimal',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const baseDebtCoeff = BigNumber.from(await contract.baseDebtCoeff());
    return [toHumanString(baseDebtCoeff)];
  },
};

const quoteCollateralCoeffState: ContractStateDescription = {
  stateName: 'quoteCollateralCoeff',
  valueUnits: 'decimal',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const quoteCollateralCoeff = BigNumber.from(await contract.quoteCollateralCoeff());
    return [toHumanString(quoteCollateralCoeff)];
  },
};

const quoteDebtCoeffState: ContractStateDescription = {
  stateName: 'quoteDebtCoeff',
  valueUnits: 'decimal',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const quotedDebtCoeff = BigNumber.from(await contract.quoteDebtCoeff());
    return [toHumanString(quotedDebtCoeff)];
  },
};

const systemLeverageShortState: ContractStateDescription = {
  stateName: 'systemLeverage.short',
  valueUnits: 'decimal',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const leverageShort = BigNumber.from((await contract.systemLeverage()).shortX96);
    return [toHumanString(leverageShort)];
  },
};

const systemLeverageLongState: ContractStateDescription = {
  stateName: 'systemLeverage.long',
  valueUnits: 'decimal',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    _signer: ethers.Signer,
    _args: string[],
    _contractsContext: ContractsParams
  ): Promise<string[]> => {
    const leverageLong = BigNumber.from((await contract.systemLeverage()).longX96);
    return [toHumanString(leverageLong)];
  },
};

const basePriceState: ContractStateDescription = {
  stateName: 'basePrice',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    _args: string[],
    contractsContext: ContractsParams
  ): Promise<string[]> => {
    const [quoteDecimals, baseDecimals] = await Promise.all([
      contractsContext.quoteTokenContract.decimals(),
      contractsContext.baseTokenContract.decimals(),
    ]);

    const decimals = BigNumber.from(10n).pow(BigNumber.from(baseDecimals).sub(BigNumber.from(quoteDecimals)));

    const basePrice = BigNumber.from((await contract.getBasePrice()).inner).mul(decimals);
    return [toHumanString(basePrice)];
  },
};

export const positionsState: ContractStateDescription = {
  stateName: 'getPositions',
  valueUnits: '',
  argsNames: ['address'],
  fetchValue: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    contractsContext: ContractsParams
  ): Promise<string[]> => {
    if (args.length !== 1) {
      console.error(`positionsState: invalid count of args`);
      return ['-'];
    }
    const [address, baseDecimals, quoteDecimals, basePriceWrapped] = await Promise.all([
      signer.getAddress(),
      contractsContext.baseTokenContract.decimals(),
      contractsContext.quoteTokenContract.decimals(),
      contractsContext.marginlyPoolContract.getBasePrice(),
    ]);

    const basePrice = basePriceWrapped.inner;
    const pos = await getPosition(contract, address);

    let baseCoeff = BigNumber.from(0);
    let quoteCoeff = BigNumber.from(0);
    let collateral = BigNumber.from(0);
    let debt = BigNumber.from(0);
    let leverage = BigNumber.from(1);

    if (pos.type === PositionType.Lend) {
      [quoteCoeff, baseCoeff] = await Promise.all([
        contractsContext.marginlyPoolContract.quoteCollateralCoeff(),
        contractsContext.marginlyPoolContract.baseCollateralCoeff(),
      ]);

      collateral = pos.discountedQuoteAmount
        .mul(quoteCoeff)
        .div(FP96.one)
        .add(pos.discountedBaseAmount.mul(basePrice).mul(baseCoeff).div(FP96.one).div(FP96.one));
      debt = BigNumber.from(0);
    } else if (pos.type === PositionType.Short) {
      [quoteCoeff, baseCoeff] = await Promise.all([
        contractsContext.marginlyPoolContract.quoteCollateralCoeff(),
        contractsContext.marginlyPoolContract.baseDebtCoeff(),
      ]);

      collateral = pos.discountedQuoteAmount.mul(quoteCoeff).div(FP96.one);
      debt = pos.discountedBaseAmount.mul(baseCoeff).mul(basePrice).div(FP96.one).div(FP96.one);
      leverage = collateral.div(collateral.sub(debt));
    } else if (pos.type === PositionType.Long) {
      [quoteCoeff, baseCoeff] = await Promise.all([
        contractsContext.marginlyPoolContract.quoteDebtCoeff(),
        contractsContext.marginlyPoolContract.baseCollateralCoeff(),
      ]);

      collateral = pos.discountedBaseAmount.mul(baseCoeff).mul(basePrice).div(FP96.one).div(FP96.one);
      debt = pos.discountedQuoteAmount.mul(quoteCoeff).div(FP96.one);
      leverage = collateral.div(collateral.sub(debt));
    }

    const realBaseAmount = pos.discountedBaseAmount.mul(baseCoeff).div(FP96.one);
    const realQuoteAmount = pos.discountedQuoteAmount.mul(quoteCoeff).div(FP96.one);
    const net = collateral.sub(debt);

    return [
      address,
      pos.heapPosition.toString(),
      positionEnumToStr(pos.type),
      ethers.utils.formatUnits(pos.discountedBaseAmount, baseDecimals),
      ethers.utils.formatUnits(pos.discountedQuoteAmount, quoteDecimals),
      ethers.utils.formatUnits(realBaseAmount, baseDecimals),
      ethers.utils.formatUnits(realQuoteAmount, quoteDecimals),
      leverage.toString(),
      ethers.utils.formatUnits(net, quoteDecimals),
    ];
  },
};

export const ownerState: ContractStateDescription = {
  stateName: 'owner',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    contractsContext: ContractsParams
  ): Promise<string[]> => {
    const owner = await contractsContext.marginlyFactoryContract.owner();
    return [owner.toString()];
  },
};

const poolBaseBalanceState: ContractStateDescription = {
  stateName: 'poolBase balance',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    contractsContext: ContractsParams
  ): Promise<string[]> => {
    const baseTokenContract = await getBaseTokenContract(contract);
    const decimals = await baseTokenContract.decimals();
    const balance = await baseTokenContract.balanceOf(contractsContext.marginlyPoolContract.address);
    const symbol = await baseTokenContract.symbol();
    return [ethers.utils.formatUnits(balance, decimals) + ' ' + symbol];
  },
};

const poolQuoteBalanceState: ContractStateDescription = {
  stateName: 'poolQuote balance',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    contractsContext: ContractsParams
  ): Promise<string[]> => {
    const quoteTokenContract = await getQuoteTokenContract(contract);
    const decimals = await quoteTokenContract.decimals();
    const balance = await quoteTokenContract.balanceOf(contractsContext.marginlyPoolContract.address);
    const symbol = await quoteTokenContract.symbol();
    return [ethers.utils.formatUnits(balance, decimals) + ' ' + symbol];
  },
};

export const workingModeState: ContractStateDescription = {
  stateName: 'mode',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    contractsContext: ContractsParams
  ): Promise<string[]> => {
    const mode = +(await contractsContext.marginlyPoolContract.mode());
    let modeStr;
    switch (mode) {
      case 0:
        modeStr = 'Regular';
        break;
      case 1:
        modeStr = 'Recovery';
        break;
      case 2:
        modeStr = 'ShortEmergency';
        break;
      case 3:
        modeStr = 'LongEmergency';
        break;
      default:
        modeStr = 'Unknown';
    }
    return [modeStr];
  },
};

export const emergencyWithdrawCoeffState: ContractStateDescription = {
  stateName: 'emergencyWithdrawCoeff',
  valueUnits: '',
  argsNames: [],
  fetchValue: async (
    contract: ethers.Contract,
    signer: ethers.Signer,
    args: string[],
    contractsContext: ContractsParams
  ): Promise<string[]> => {
    const emergencyWithdrawCoeff = await contractsContext.marginlyPoolContract.emergencyWithdrawCoeff();
    return [toHumanString(emergencyWithdrawCoeff)];
  },
};

export const marginlyPoolStatesWithoutArgs = [
  signerEthBalanceState,
  signerQuoteBalanceState,
  signerBaseBalanceState,

  discountedQuoteCollateralState,
  discountedQuoteDebtState,
  discountedBaseCollateralState,
  discountedBaseDebtState,

  lastReinitTimestampSecondsState,

  baseCollateralCoeffState,
  baseDebtCoeffState,
  quoteCollateralCoeffState,
  quoteDebtCoeffState,

  systemLeverageShortState,
  systemLeverageLongState,

  paramsMaxLeverageState,
  paramsRecoveryMaxLeverageState,
  paramsInterestRateState,
  paramsSwapFeeState,
  paramsPriceSecondsAgoState,
  paramsPositionMinAmountState,
  paramsPositionSlippageState,
  paramsMcSlippageState,

  basePriceState,

  feeHolderState,
  feeHolderQuoteBalanceState,
  ownerState,

  poolBaseBalanceState,
  poolQuoteBalanceState,

  workingModeState,
  emergencyWithdrawCoeffState,
];
