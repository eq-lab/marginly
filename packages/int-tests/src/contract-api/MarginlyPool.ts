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

  baseCollateralCoeff(override?: CallOverrides): Promise<BigNumberish>;
  baseDebtCoeff(override?: CallOverrides): Promise<BigNumberish>;
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
  discountedBaseCollateral(override?: CallOverrides): Promise<BigNumberish>;
  discountedBaseDebt(override?: CallOverrides): Promise<BigNumberish>;
  discountedQuoteCollateral(override?: CallOverrides): Promise<BigNumberish>;
  discountedQuoteDebt(override?: CallOverrides): Promise<BigNumberish>;
  emergencyWithdraw(
    unwrapWETH: PromiseOrValue<boolean>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  emergencyWithdrawCoeff(override?: CallOverrides): Promise<BigNumberish>;
  factory(override?: CallOverrides): Promise<string>;
  getBasePrice(override?: CallOverrides): Promise<{ inner: BigNumberish }>;
  getCurrentBasePrice(override?: CallOverrides): Promise<{ inner: BigNumberish }>;
  getLongHeapPosition(
    index: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<[boolean, { key: BigNumberish; account: string }]>;
  getShortHeapPosition(
    index: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<[boolean, { key: BigNumberish; account: string }]>;
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
      swapFee: BigNumberish;
      positionSlippage: BigNumberish;
      mcSlippage: BigNumberish;
      positionMinAmount: BigNumberish;
      baseLimit: BigNumberish;
      quoteLimit: BigNumberish;
    }>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  initialPrice(override?: CallOverrides): Promise<BigNumberish>;
  lastReinitTimestampSeconds(override?: CallOverrides): Promise<BigNumberish>;
  long(
    realBaseAmount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  mode(override?: CallOverrides): Promise<BigNumberish>;
  params(
    override?: CallOverrides
  ): Promise<{
    maxLeverage: BigNumberish;
    priceSecondsAgo: BigNumberish;
    interestRate: BigNumberish;
    swapFee: BigNumberish;
    positionSlippage: BigNumberish;
    mcSlippage: BigNumberish;
    positionMinAmount: BigNumberish;
    baseLimit: BigNumberish;
    quoteLimit: BigNumberish;
  }>;
  positions(
    arg0: PromiseOrValue<string>,
    override?: CallOverrides
  ): Promise<{
    heapPosition: BigNumberish;
    _type: BigNumberish;
    discountedBaseAmount: BigNumberish;
    discountedQuoteAmount: BigNumberish;
  }>;
  quoteCollateralCoeff(override?: CallOverrides): Promise<BigNumberish>;
  quoteDebtCoeff(override?: CallOverrides): Promise<BigNumberish>;
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
  systemLeverage(override?: CallOverrides): Promise<{ shortX96: BigNumberish; longX96: BigNumberish }>;
  uniswapFee(override?: CallOverrides): Promise<BigNumberish>;
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
    baseCollateralCoeff(override?: CallOverrides): Promise<{ inner: BigNumberish }>;
    baseDebtCoeff(override?: CallOverrides): Promise<{ inner: BigNumberish }>;
    baseToken(override?: CallOverrides): Promise<[string]>;
    discountedBaseCollateral(override?: CallOverrides): Promise<[BigNumberish]>;
    discountedBaseDebt(override?: CallOverrides): Promise<[BigNumberish]>;
    discountedQuoteCollateral(override?: CallOverrides): Promise<[BigNumberish]>;
    discountedQuoteDebt(override?: CallOverrides): Promise<[BigNumberish]>;
    emergencyWithdrawCoeff(override?: CallOverrides): Promise<{ inner: BigNumberish }>;
    factory(override?: CallOverrides): Promise<[string]>;
    getBasePrice(override?: CallOverrides): Promise<[{ inner: BigNumberish }]>;
    getCurrentBasePrice(override?: CallOverrides): Promise<[{ inner: BigNumberish }]>;
    getLongHeapPosition(
      index: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<[boolean, { key: BigNumberish; account: string }]>;
    getShortHeapPosition(
      index: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<[boolean, { key: BigNumberish; account: string }]>;
    initialPrice(override?: CallOverrides): Promise<{ inner: BigNumberish }>;
    lastReinitTimestampSeconds(override?: CallOverrides): Promise<[BigNumberish]>;
    mode(override?: CallOverrides): Promise<[BigNumberish]>;
    params(
      override?: CallOverrides
    ): Promise<{
      maxLeverage: BigNumberish;
      priceSecondsAgo: BigNumberish;
      interestRate: BigNumberish;
      swapFee: BigNumberish;
      positionSlippage: BigNumberish;
      mcSlippage: BigNumberish;
      positionMinAmount: BigNumberish;
      baseLimit: BigNumberish;
      quoteLimit: BigNumberish;
    }>;
    positions(
      arg0: PromiseOrValue<string>,
      override?: CallOverrides
    ): Promise<{
      heapPosition: BigNumberish;
      _type: BigNumberish;
      discountedBaseAmount: BigNumberish;
      discountedQuoteAmount: BigNumberish;
    }>;
    quoteCollateralCoeff(override?: CallOverrides): Promise<{ inner: BigNumberish }>;
    quoteDebtCoeff(override?: CallOverrides): Promise<{ inner: BigNumberish }>;
    quoteToken(override?: CallOverrides): Promise<[string]>;
    quoteTokenIsToken0(override?: CallOverrides): Promise<[boolean]>;
    systemLeverage(override?: CallOverrides): Promise<{ shortX96: BigNumberish; longX96: BigNumberish }>;
    uniswapFee(override?: CallOverrides): Promise<[BigNumberish]>;
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
