import {
  BaseContract,
  BytesLike,
  Signer,
  providers,
  utils,
  CallOverrides,
  BigNumberish,
  Overrides,
  ContractTransaction,
  PayableOverrides,
  BigNumber,
  PopulatedTransaction,
  ContractFactory,
} from 'ethers';
// @ts-ignore
import { abi, bytecode } from '@marginly/contracts/artifacts/contracts/MarginlyPool.sol/MarginlyPool.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface MarginlyPoolInterface extends utils.Interface {
  functions: {
    'baseCollateralCoeff()': utils.FunctionFragment;
    'baseDebtCoeff()': utils.FunctionFragment;
    'baseDelevCoeff()': utils.FunctionFragment;
    'baseToken()': utils.FunctionFragment;
    'defaultSwapCallData()': utils.FunctionFragment;
    'discountedBaseCollateral()': utils.FunctionFragment;
    'discountedBaseDebt()': utils.FunctionFragment;
    'discountedQuoteCollateral()': utils.FunctionFragment;
    'discountedQuoteDebt()': utils.FunctionFragment;
    'emergencyWithdrawCoeff()': utils.FunctionFragment;
    'execute(uint8,uint256,int256,uint256,bool,address,uint256)': utils.FunctionFragment;
    'factory()': utils.FunctionFragment;
    'getBasePrice()': utils.FunctionFragment;
    'getHeapPosition(uint32,bool)': utils.FunctionFragment;
    'getLiquidationPrice()': utils.FunctionFragment;
    'initialize(address,address,address,uint32,tuple)': utils.FunctionFragment;
    'initialPrice()': utils.FunctionFragment;
    'lastReinitTimestampSeconds()': utils.FunctionFragment;
    'mode()': utils.FunctionFragment;
    'params()': utils.FunctionFragment;
    'positions(address)': utils.FunctionFragment;
    'priceOracle()': utils.FunctionFragment;
    'quoteCollateralCoeff()': utils.FunctionFragment;
    'quoteDebtCoeff()': utils.FunctionFragment;
    'quoteDelevCoeff()': utils.FunctionFragment;
    'quoteToken()': utils.FunctionFragment;
    'setParameters(tuple)': utils.FunctionFragment;
    'shutDown(uint256)': utils.FunctionFragment;
    'sweepETH()': utils.FunctionFragment;
    'systemLeverage()': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'baseCollateralCoeff'
      | 'baseDebtCoeff'
      | 'baseDelevCoeff'
      | 'baseToken'
      | 'defaultSwapCallData'
      | 'discountedBaseCollateral'
      | 'discountedBaseDebt'
      | 'discountedQuoteCollateral'
      | 'discountedQuoteDebt'
      | 'emergencyWithdrawCoeff'
      | 'execute'
      | 'factory'
      | 'getBasePrice'
      | 'getHeapPosition'
      | 'getLiquidationPrice'
      | 'initialize'
      | 'initialPrice'
      | 'lastReinitTimestampSeconds'
      | 'mode'
      | 'params'
      | 'positions'
      | 'priceOracle'
      | 'quoteCollateralCoeff'
      | 'quoteDebtCoeff'
      | 'quoteDelevCoeff'
      | 'quoteToken'
      | 'setParameters'
      | 'shutDown'
      | 'sweepETH'
      | 'systemLeverage'
  ): utils.FunctionFragment;
}

export interface MarginlyPoolContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MarginlyPoolInterface;

  baseCollateralCoeff(override?: CallOverrides): Promise<BigNumber>;
  baseDebtCoeff(override?: CallOverrides): Promise<BigNumber>;
  baseDelevCoeff(override?: CallOverrides): Promise<BigNumber>;
  baseToken(override?: CallOverrides): Promise<string>;
  defaultSwapCallData(override?: CallOverrides): Promise<BigNumber>;
  discountedBaseCollateral(override?: CallOverrides): Promise<BigNumber>;
  discountedBaseDebt(override?: CallOverrides): Promise<BigNumber>;
  discountedQuoteCollateral(override?: CallOverrides): Promise<BigNumber>;
  discountedQuoteDebt(override?: CallOverrides): Promise<BigNumber>;
  emergencyWithdrawCoeff(override?: CallOverrides): Promise<BigNumber>;
  execute(
    call: BigNumberish,
    amount1: BigNumberish,
    amount2: BigNumberish,
    limitPriceX96: BigNumberish,
    flag: boolean,
    receivePositionAddress: string,
    swapCalldata: BigNumberish,
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  factory(override?: CallOverrides): Promise<string>;
  getBasePrice(override?: CallOverrides): Promise<{ inner: BigNumber }>;
  getHeapPosition(
    index: PromiseOrValue<BigNumberish>,
    _short: PromiseOrValue<boolean>,
    override?: CallOverrides
  ): Promise<[boolean, { key: BigNumber; account: string }]>;
  getLiquidationPrice(override?: CallOverrides): Promise<{ inner: BigNumber }>;
  initialize(
    _quoteToken: PromiseOrValue<string>,
    _baseToken: PromiseOrValue<string>,
    _priceOracle: PromiseOrValue<string>,
    _defaultSwapCallData: PromiseOrValue<BigNumberish>,
    _params: PromiseOrValue<{
      maxLeverage: BigNumberish;
      interestRate: BigNumberish;
      fee: BigNumberish;
      swapFee: BigNumberish;
      mcSlippage: BigNumberish;
      positionMinAmount: BigNumberish;
      quoteLimit: BigNumberish;
    }>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  initialPrice(override?: CallOverrides): Promise<BigNumber>;
  lastReinitTimestampSeconds(override?: CallOverrides): Promise<BigNumber>;
  mode(override?: CallOverrides): Promise<number>;
  params(
    override?: CallOverrides
  ): Promise<{
    maxLeverage: number;
    interestRate: BigNumber;
    fee: BigNumber;
    swapFee: BigNumber;
    mcSlippage: BigNumber;
    positionMinAmount: BigNumber;
    quoteLimit: BigNumber;
  }>;
  positions(
    arg0: PromiseOrValue<string>,
    override?: CallOverrides
  ): Promise<{
    _type: number;
    heapPosition: BigNumber;
    discountedBaseAmount: BigNumber;
    discountedQuoteAmount: BigNumber;
  }>;
  priceOracle(override?: CallOverrides): Promise<string>;
  quoteCollateralCoeff(override?: CallOverrides): Promise<BigNumber>;
  quoteDebtCoeff(override?: CallOverrides): Promise<BigNumber>;
  quoteDelevCoeff(override?: CallOverrides): Promise<BigNumber>;
  quoteToken(override?: CallOverrides): Promise<string>;
  setParameters(
    _params: PromiseOrValue<{
      maxLeverage: BigNumberish;
      interestRate: BigNumberish;
      fee: BigNumberish;
      swapFee: BigNumberish;
      mcSlippage: BigNumberish;
      positionMinAmount: BigNumberish;
      quoteLimit: BigNumberish;
    }>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  shutDown(
    swapCalldata: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  sweepETH(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  systemLeverage(override?: CallOverrides): Promise<{ shortX96: BigNumber; longX96: BigNumber }>;

  functions: {
    baseCollateralCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    baseDebtCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    baseDelevCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    baseToken(override?: CallOverrides): Promise<[string]>;
    defaultSwapCallData(override?: CallOverrides): Promise<[BigNumber]>;
    discountedBaseCollateral(override?: CallOverrides): Promise<[BigNumber]>;
    discountedBaseDebt(override?: CallOverrides): Promise<[BigNumber]>;
    discountedQuoteCollateral(override?: CallOverrides): Promise<[BigNumber]>;
    discountedQuoteDebt(override?: CallOverrides): Promise<[BigNumber]>;
    emergencyWithdrawCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    factory(override?: CallOverrides): Promise<[string]>;
    getBasePrice(override?: CallOverrides): Promise<[{ inner: BigNumber }]>;
    getHeapPosition(
      index: PromiseOrValue<BigNumberish>,
      _short: PromiseOrValue<boolean>,
      override?: CallOverrides
    ): Promise<[boolean, { key: BigNumber; account: string }]>;
    getLiquidationPrice(override?: CallOverrides): Promise<[{ inner: BigNumber }]>;
    initialPrice(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    lastReinitTimestampSeconds(override?: CallOverrides): Promise<[BigNumber]>;
    mode(override?: CallOverrides): Promise<[number]>;
    params(
      override?: CallOverrides
    ): Promise<{
      maxLeverage: number;
      interestRate: BigNumber;
      fee: BigNumber;
      swapFee: BigNumber;
      mcSlippage: BigNumber;
      positionMinAmount: BigNumber;
      quoteLimit: BigNumber;
    }>;
    positions(
      arg0: PromiseOrValue<string>,
      override?: CallOverrides
    ): Promise<{
      _type: number;
      heapPosition: BigNumber;
      discountedBaseAmount: BigNumber;
      discountedQuoteAmount: BigNumber;
    }>;
    priceOracle(override?: CallOverrides): Promise<[string]>;
    quoteCollateralCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    quoteDebtCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    quoteDelevCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    quoteToken(override?: CallOverrides): Promise<[string]>;
    systemLeverage(override?: CallOverrides): Promise<{ shortX96: BigNumber; longX96: BigNumber }>;
  };
  estimateGas: {
    execute(
      call: BigNumberish,
      amount1: BigNumberish,
      amount2: BigNumberish,
      limitPriceX96: BigNumberish,
      flag: boolean,
      receivePositionAddress: string,
      swapCalldata: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    initialize(
      _quoteToken: PromiseOrValue<string>,
      _baseToken: PromiseOrValue<string>,
      _priceOracle: PromiseOrValue<string>,
      _defaultSwapCallData: PromiseOrValue<BigNumberish>,
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    setParameters(
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    shutDown(
      swapCalldata: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    sweepETH(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
  };
  populateTransaction: {
    execute(
      call: BigNumberish,
      amount1: BigNumberish,
      amount2: BigNumberish,
      limitPriceX96: BigNumberish,
      flag: boolean,
      receivePositionAddress: string,
      swapCalldata: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    initialize(
      _quoteToken: PromiseOrValue<string>,
      _baseToken: PromiseOrValue<string>,
      _priceOracle: PromiseOrValue<string>,
      _defaultSwapCallData: PromiseOrValue<BigNumberish>,
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    setParameters(
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    shutDown(
      swapCalldata: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    sweepETH(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
  };
  callStatic: {
    execute(
      call: BigNumberish,
      amount1: BigNumberish,
      amount2: BigNumberish,
      limitPriceX96: BigNumberish,
      flag: boolean,
      receivePositionAddress: string,
      swapCalldata: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    initialize(
      _quoteToken: PromiseOrValue<string>,
      _baseToken: PromiseOrValue<string>,
      _priceOracle: PromiseOrValue<string>,
      _defaultSwapCallData: PromiseOrValue<BigNumberish>,
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    setParameters(
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    shutDown(
      swapCalldata: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    sweepETH(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
  };
}

export async function deploy(signer?: Signer): Promise<MarginlyPoolContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  return (await contract.deployed()) as any;
}

export function connect(addressOrName: string, signerOrProvider?: Signer | providers.Provider): MarginlyPoolContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
