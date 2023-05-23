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
    'baseToken()': utils.FunctionFragment;
    'closePosition()': utils.FunctionFragment;
    'depositBase(uint256,uint256)': utils.FunctionFragment;
    'depositQuote(uint256,uint256)': utils.FunctionFragment;
    'discountedBaseCollateral()': utils.FunctionFragment;
    'discountedBaseDebt()': utils.FunctionFragment;
    'discountedQuoteCollateral()': utils.FunctionFragment;
    'discountedQuoteDebt()': utils.FunctionFragment;
    'emergencyWithdraw(bool)': utils.FunctionFragment;
    'emergencyWithdrawCoeff()': utils.FunctionFragment;
    'factory()': utils.FunctionFragment;
    'getBasePrice()': utils.FunctionFragment;
    'getCurrentBasePrice()': utils.FunctionFragment;
    'getLongHeapPosition(uint32)': utils.FunctionFragment;
    'getShortHeapPosition(uint32)': utils.FunctionFragment;
    'initialize(address,address,uint24,bool,address,tuple)': utils.FunctionFragment;
    'initialPrice()': utils.FunctionFragment;
    'lastReinitTimestampSeconds()': utils.FunctionFragment;
    'long(uint256)': utils.FunctionFragment;
    'mode()': utils.FunctionFragment;
    'params()': utils.FunctionFragment;
    'positions(address)': utils.FunctionFragment;
    'quoteCollateralCoeff()': utils.FunctionFragment;
    'quoteDebtCoeff()': utils.FunctionFragment;
    'quoteToken()': utils.FunctionFragment;
    'quoteTokenIsToken0()': utils.FunctionFragment;
    'receivePosition(address,uint256,uint256)': utils.FunctionFragment;
    'reinit()': utils.FunctionFragment;
    'setParameters(tuple)': utils.FunctionFragment;
    'short(uint256)': utils.FunctionFragment;
    'shutDown()': utils.FunctionFragment;
    'sweepETH()': utils.FunctionFragment;
    'systemLeverage()': utils.FunctionFragment;
    'uniswapFee()': utils.FunctionFragment;
    'uniswapPool()': utils.FunctionFragment;
    'unlocked()': utils.FunctionFragment;
    'withdrawBase(uint256,bool)': utils.FunctionFragment;
    'withdrawQuote(uint256,bool)': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'baseCollateralCoeff'
      | 'baseDebtCoeff'
      | 'baseToken'
      | 'closePosition'
      | 'depositBase'
      | 'depositQuote'
      | 'discountedBaseCollateral'
      | 'discountedBaseDebt'
      | 'discountedQuoteCollateral'
      | 'discountedQuoteDebt'
      | 'emergencyWithdraw'
      | 'emergencyWithdrawCoeff'
      | 'factory'
      | 'getBasePrice'
      | 'getCurrentBasePrice'
      | 'getLongHeapPosition'
      | 'getShortHeapPosition'
      | 'initialize'
      | 'initialPrice'
      | 'lastReinitTimestampSeconds'
      | 'long'
      | 'mode'
      | 'params'
      | 'positions'
      | 'quoteCollateralCoeff'
      | 'quoteDebtCoeff'
      | 'quoteToken'
      | 'quoteTokenIsToken0'
      | 'receivePosition'
      | 'reinit'
      | 'setParameters'
      | 'short'
      | 'shutDown'
      | 'sweepETH'
      | 'systemLeverage'
      | 'uniswapFee'
      | 'uniswapPool'
      | 'unlocked'
      | 'withdrawBase'
      | 'withdrawQuote'
  ): utils.FunctionFragment;
}

export interface MarginlyPoolContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MarginlyPoolInterface;

  baseCollateralCoeff(override?: CallOverrides): Promise<BigNumber>;
  baseDebtCoeff(override?: CallOverrides): Promise<BigNumber>;
  baseToken(override?: CallOverrides): Promise<string>;
  closePosition(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  depositBase(
    amount: BigNumberish,
    longAmount: BigNumberish,
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  depositQuote(
    amount: BigNumberish,
    shortAmount: BigNumberish,
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  discountedBaseCollateral(override?: CallOverrides): Promise<BigNumber>;
  discountedBaseDebt(override?: CallOverrides): Promise<BigNumber>;
  discountedQuoteCollateral(override?: CallOverrides): Promise<BigNumber>;
  discountedQuoteDebt(override?: CallOverrides): Promise<BigNumber>;
  emergencyWithdraw(
    unwrapWETH: PromiseOrValue<boolean>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  emergencyWithdrawCoeff(override?: CallOverrides): Promise<BigNumber>;
  factory(override?: CallOverrides): Promise<string>;
  getBasePrice(override?: CallOverrides): Promise<{ inner: BigNumber }>;
  getCurrentBasePrice(override?: CallOverrides): Promise<{ inner: BigNumber }>;
  getLongHeapPosition(
    index: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<[boolean, { key: BigNumber; account: string }]>;
  getShortHeapPosition(
    index: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<[boolean, { key: BigNumber; account: string }]>;
  initialize(
    _quoteToken: PromiseOrValue<string>,
    _baseToken: PromiseOrValue<string>,
    _uniswapFee: PromiseOrValue<BigNumberish>,
    _quoteTokenIsToken0: PromiseOrValue<boolean>,
    _uniswapPool: PromiseOrValue<string>,
    _params: PromiseOrValue<{
      maxLeverage: BigNumberish;
      priceSecondsAgo: BigNumberish;
      interestRate: BigNumberish;
      fee: BigNumberish;
      swapFee: BigNumberish;
      positionSlippage: BigNumberish;
      mcSlippage: BigNumberish;
      positionMinAmount: BigNumberish;
      baseLimit: BigNumberish;
      quoteLimit: BigNumberish;
    }>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  initialPrice(override?: CallOverrides): Promise<BigNumber>;
  lastReinitTimestampSeconds(override?: CallOverrides): Promise<BigNumber>;
  long(
    realBaseAmount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  mode(override?: CallOverrides): Promise<number>;
  params(
    override?: CallOverrides
  ): Promise<{
    maxLeverage: number;
    priceSecondsAgo: BigNumber;
    interestRate: BigNumber;
    fee: BigNumber;
    swapFee: BigNumber;
    positionSlippage: BigNumber;
    mcSlippage: BigNumber;
    positionMinAmount: BigNumber;
    baseLimit: BigNumber;
    quoteLimit: BigNumber;
  }>;
  positions(
    arg0: PromiseOrValue<string>,
    override?: CallOverrides
  ): Promise<{
    heapPosition: BigNumber;
    _type: number;
    discountedBaseAmount: BigNumber;
    discountedQuoteAmount: BigNumber;
  }>;
  quoteCollateralCoeff(override?: CallOverrides): Promise<BigNumber>;
  quoteDebtCoeff(override?: CallOverrides): Promise<BigNumber>;
  quoteToken(override?: CallOverrides): Promise<string>;
  quoteTokenIsToken0(override?: CallOverrides): Promise<boolean>;
  receivePosition(
    badPositionAddress: PromiseOrValue<string>,
    quoteAmount: PromiseOrValue<BigNumberish>,
    baseAmount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  reinit(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  setParameters(
    _params: PromiseOrValue<{
      maxLeverage: BigNumberish;
      priceSecondsAgo: BigNumberish;
      interestRate: BigNumberish;
      fee: BigNumberish;
      swapFee: BigNumberish;
      positionSlippage: BigNumberish;
      mcSlippage: BigNumberish;
      positionMinAmount: BigNumberish;
      baseLimit: BigNumberish;
      quoteLimit: BigNumberish;
    }>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  short(
    realBaseAmount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  shutDown(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  sweepETH(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  systemLeverage(override?: CallOverrides): Promise<{ shortX96: BigNumber; longX96: BigNumber }>;
  uniswapFee(override?: CallOverrides): Promise<BigNumber>;
  uniswapPool(override?: CallOverrides): Promise<string>;
  unlocked(override?: CallOverrides): Promise<boolean>;
  withdrawBase(
    realAmount: PromiseOrValue<BigNumberish>,
    unwrapWETH: PromiseOrValue<boolean>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  withdrawQuote(
    realAmount: PromiseOrValue<BigNumberish>,
    unwrapWETH: PromiseOrValue<boolean>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {
    baseCollateralCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    baseDebtCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    baseToken(override?: CallOverrides): Promise<[string]>;
    discountedBaseCollateral(override?: CallOverrides): Promise<[BigNumber]>;
    discountedBaseDebt(override?: CallOverrides): Promise<[BigNumber]>;
    discountedQuoteCollateral(override?: CallOverrides): Promise<[BigNumber]>;
    discountedQuoteDebt(override?: CallOverrides): Promise<[BigNumber]>;
    emergencyWithdrawCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    factory(override?: CallOverrides): Promise<[string]>;
    getBasePrice(override?: CallOverrides): Promise<[{ inner: BigNumber }]>;
    getCurrentBasePrice(override?: CallOverrides): Promise<[{ inner: BigNumber }]>;
    getLongHeapPosition(
      index: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<[boolean, { key: BigNumber; account: string }]>;
    getShortHeapPosition(
      index: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<[boolean, { key: BigNumber; account: string }]>;
    initialPrice(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    lastReinitTimestampSeconds(override?: CallOverrides): Promise<[BigNumber]>;
    mode(override?: CallOverrides): Promise<[number]>;
    params(
      override?: CallOverrides
    ): Promise<{
      maxLeverage: number;
      priceSecondsAgo: BigNumber;
      interestRate: BigNumber;
      fee: BigNumber;
      swapFee: BigNumber;
      positionSlippage: BigNumber;
      mcSlippage: BigNumber;
      positionMinAmount: BigNumber;
      baseLimit: BigNumber;
      quoteLimit: BigNumber;
    }>;
    positions(
      arg0: PromiseOrValue<string>,
      override?: CallOverrides
    ): Promise<{
      heapPosition: BigNumber;
      _type: number;
      discountedBaseAmount: BigNumber;
      discountedQuoteAmount: BigNumber;
    }>;
    quoteCollateralCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    quoteDebtCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    quoteToken(override?: CallOverrides): Promise<[string]>;
    quoteTokenIsToken0(override?: CallOverrides): Promise<[boolean]>;
    systemLeverage(override?: CallOverrides): Promise<{ shortX96: BigNumber; longX96: BigNumber }>;
    uniswapFee(override?: CallOverrides): Promise<[BigNumber]>;
    uniswapPool(override?: CallOverrides): Promise<[string]>;
    unlocked(override?: CallOverrides): Promise<[boolean]>;
  };
  estimateGas: {
    closePosition(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    depositBase(
      amount: BigNumberish,
      longAmount: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    depositQuote(
      amount: BigNumberish,
      shortAmount: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    emergencyWithdraw(
      unwrapWETH: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    initialize(
      _quoteToken: PromiseOrValue<string>,
      _baseToken: PromiseOrValue<string>,
      _uniswapFee: PromiseOrValue<BigNumberish>,
      _quoteTokenIsToken0: PromiseOrValue<boolean>,
      _uniswapPool: PromiseOrValue<string>,
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        priceSecondsAgo: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        positionSlippage: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        baseLimit: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    long(
      realBaseAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    receivePosition(
      badPositionAddress: PromiseOrValue<string>,
      quoteAmount: PromiseOrValue<BigNumberish>,
      baseAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    reinit(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    setParameters(
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        priceSecondsAgo: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        positionSlippage: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        baseLimit: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    short(
      realBaseAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    shutDown(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    sweepETH(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    withdrawBase(
      realAmount: PromiseOrValue<BigNumberish>,
      unwrapWETH: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    withdrawQuote(
      realAmount: PromiseOrValue<BigNumberish>,
      unwrapWETH: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    closePosition(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    depositBase(
      amount: BigNumberish,
      longAmount: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    depositQuote(
      amount: BigNumberish,
      shortAmount: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    emergencyWithdraw(
      unwrapWETH: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    initialize(
      _quoteToken: PromiseOrValue<string>,
      _baseToken: PromiseOrValue<string>,
      _uniswapFee: PromiseOrValue<BigNumberish>,
      _quoteTokenIsToken0: PromiseOrValue<boolean>,
      _uniswapPool: PromiseOrValue<string>,
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        priceSecondsAgo: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        positionSlippage: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        baseLimit: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    long(
      realBaseAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    receivePosition(
      badPositionAddress: PromiseOrValue<string>,
      quoteAmount: PromiseOrValue<BigNumberish>,
      baseAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    reinit(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    setParameters(
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        priceSecondsAgo: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        positionSlippage: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        baseLimit: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    short(
      realBaseAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    shutDown(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    sweepETH(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    withdrawBase(
      realAmount: PromiseOrValue<BigNumberish>,
      unwrapWETH: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    withdrawQuote(
      realAmount: PromiseOrValue<BigNumberish>,
      unwrapWETH: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    closePosition(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    depositBase(
      amount: BigNumberish,
      longAmount: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    depositQuote(
      amount: BigNumberish,
      shortAmount: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    emergencyWithdraw(
      unwrapWETH: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    initialize(
      _quoteToken: PromiseOrValue<string>,
      _baseToken: PromiseOrValue<string>,
      _uniswapFee: PromiseOrValue<BigNumberish>,
      _quoteTokenIsToken0: PromiseOrValue<boolean>,
      _uniswapPool: PromiseOrValue<string>,
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        priceSecondsAgo: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        positionSlippage: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        baseLimit: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    long(
      realBaseAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    receivePosition(
      badPositionAddress: PromiseOrValue<string>,
      quoteAmount: PromiseOrValue<BigNumberish>,
      baseAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    reinit(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    setParameters(
      _params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        priceSecondsAgo: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        positionSlippage: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        baseLimit: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    short(
      realBaseAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    shutDown(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    sweepETH(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    withdrawBase(
      realAmount: PromiseOrValue<BigNumberish>,
      unwrapWETH: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    withdrawQuote(
      realAmount: PromiseOrValue<BigNumberish>,
      unwrapWETH: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
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
