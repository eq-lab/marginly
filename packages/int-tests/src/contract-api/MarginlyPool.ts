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
    'discountedBaseCollateral()': utils.FunctionFragment;
    'discountedBaseDebt()': utils.FunctionFragment;
    'discountedQuoteCollateral()': utils.FunctionFragment;
    'discountedQuoteDebt()': utils.FunctionFragment;
    'emergencyWithdrawCoeff()': utils.FunctionFragment;
    'execute(uint8,uint256,uint256,bool,address,bytes)': utils.FunctionFragment;
    'factory()': utils.FunctionFragment;
    'getBasePrice()': utils.FunctionFragment;
    'getCurrentBasePrice()': utils.FunctionFragment;
    'getHeapPosition(uint32,bool)': utils.FunctionFragment;
    'initialize(address,address,bool,address,tuple)': utils.FunctionFragment;
    'lastReinitTimestampSeconds()': utils.FunctionFragment;
    'mode()': utils.FunctionFragment;
    'params()': utils.FunctionFragment;
    'positions(address)': utils.FunctionFragment;
    'quoteCollateralCoeff()': utils.FunctionFragment;
    'quoteDebtCoeff()': utils.FunctionFragment;
    'quoteDelevCoeff()': utils.FunctionFragment;
    'quoteToken()': utils.FunctionFragment;
    'setParameters(tuple)': utils.FunctionFragment;
    'shutDown()': utils.FunctionFragment;
    'sweepETH()': utils.FunctionFragment;
    'systemLeverage()': utils.FunctionFragment;
    'uniswapPool()': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'baseCollateralCoeff'
      | 'baseDebtCoeff'
      | 'baseDelevCoeff'
      | 'baseToken'
      | 'discountedBaseCollateral'
      | 'discountedBaseDebt'
      | 'discountedQuoteCollateral'
      | 'discountedQuoteDebt'
      | 'emergencyWithdrawCoeff'
      | 'execute'
      | 'factory'
      | 'getBasePrice'
      | 'getCurrentBasePrice'
      | 'getHeapPosition'
      | 'initialize'
      | 'lastReinitTimestampSeconds'
      | 'mode'
      | 'params'
      | 'positions'
      | 'quoteCollateralCoeff'
      | 'quoteDebtCoeff'
      | 'quoteDelevCoeff'
      | 'quoteToken'
      | 'setParameters'
      | 'shutDown'
      | 'sweepETH'
      | 'systemLeverage'
      | 'uniswapPool'
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
  discountedBaseCollateral(override?: CallOverrides): Promise<BigNumber>;
  discountedBaseDebt(override?: CallOverrides): Promise<BigNumber>;
  discountedQuoteCollateral(override?: CallOverrides): Promise<BigNumber>;
  discountedQuoteDebt(override?: CallOverrides): Promise<BigNumber>;
  emergencyWithdrawCoeff(override?: CallOverrides): Promise<BigNumber>;
  execute(
    call: BigNumberish,
    amount1: BigNumberish,
    amount2: BigNumberish,
    unwrapWETH: boolean,
    receivePositionAddress: string,
    swapCalldata: BytesLike,
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  factory(override?: CallOverrides): Promise<string>;
  getBasePrice(override?: CallOverrides): Promise<{ inner: BigNumber }>;
  getCurrentBasePrice(override?: CallOverrides): Promise<{ inner: BigNumber }>;
  getHeapPosition(
    index: PromiseOrValue<BigNumberish>,
    _short: PromiseOrValue<boolean>,
    override?: CallOverrides
  ): Promise<[boolean, { key: BigNumber; account: string }]>;
  initialize(
    _quoteToken: PromiseOrValue<string>,
    _baseToken: PromiseOrValue<string>,
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
  lastReinitTimestampSeconds(override?: CallOverrides): Promise<BigNumber>;
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
    _type: number;
    heapPosition: BigNumber;
    discountedBaseAmount: BigNumber;
    discountedQuoteAmount: BigNumber;
  }>;
  quoteCollateralCoeff(override?: CallOverrides): Promise<BigNumber>;
  quoteDebtCoeff(override?: CallOverrides): Promise<BigNumber>;
  quoteDelevCoeff(override?: CallOverrides): Promise<BigNumber>;
  quoteToken(override?: CallOverrides): Promise<string>;
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
  shutDown(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  sweepETH(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  systemLeverage(override?: CallOverrides): Promise<{ shortX96: BigNumber; longX96: BigNumber }>;
  uniswapPool(override?: CallOverrides): Promise<string>;

  functions: {
    baseCollateralCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    baseDebtCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    baseDelevCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    baseToken(override?: CallOverrides): Promise<[string]>;
    discountedBaseCollateral(override?: CallOverrides): Promise<[BigNumber]>;
    discountedBaseDebt(override?: CallOverrides): Promise<[BigNumber]>;
    discountedQuoteCollateral(override?: CallOverrides): Promise<[BigNumber]>;
    discountedQuoteDebt(override?: CallOverrides): Promise<[BigNumber]>;
    emergencyWithdrawCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    factory(override?: CallOverrides): Promise<[string]>;
    getBasePrice(override?: CallOverrides): Promise<[{ inner: BigNumber }]>;
    getCurrentBasePrice(override?: CallOverrides): Promise<[{ inner: BigNumber }]>;
    getHeapPosition(
      index: PromiseOrValue<BigNumberish>,
      _short: PromiseOrValue<boolean>,
      override?: CallOverrides
    ): Promise<[boolean, { key: BigNumber; account: string }]>;
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
      _type: number;
      heapPosition: BigNumber;
      discountedBaseAmount: BigNumber;
      discountedQuoteAmount: BigNumber;
    }>;
    quoteCollateralCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    quoteDebtCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    quoteDelevCoeff(override?: CallOverrides): Promise<{ inner: BigNumber }>;
    quoteToken(override?: CallOverrides): Promise<[string]>;
    systemLeverage(override?: CallOverrides): Promise<{ shortX96: BigNumber; longX96: BigNumber }>;
    uniswapPool(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    execute(
      call: BigNumberish,
      amount1: BigNumberish,
      amount2: BigNumberish,
      unwrapWETH: boolean,
      receivePositionAddress: string,
      swapCalldata: BytesLike,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    initialize(
      _quoteToken: PromiseOrValue<string>,
      _baseToken: PromiseOrValue<string>,
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
    shutDown(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    sweepETH(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
  };
  populateTransaction: {
    execute(
      call: BigNumberish,
      amount1: BigNumberish,
      amount2: BigNumberish,
      unwrapWETH: boolean,
      receivePositionAddress: string,
      swapCalldata: BytesLike,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    initialize(
      _quoteToken: PromiseOrValue<string>,
      _baseToken: PromiseOrValue<string>,
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
    shutDown(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    sweepETH(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
  };
  callStatic: {
    execute(
      call: BigNumberish,
      amount1: BigNumberish,
      amount2: BigNumberish,
      unwrapWETH: boolean,
      receivePositionAddress: string,
      swapCalldata: BytesLike,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    initialize(
      _quoteToken: PromiseOrValue<string>,
      _baseToken: PromiseOrValue<string>,
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
    shutDown(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
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
