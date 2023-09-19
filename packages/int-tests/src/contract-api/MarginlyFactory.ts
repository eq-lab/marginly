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
import { abi, bytecode } from '@marginly/contracts/artifacts/contracts/MarginlyFactory.sol/MarginlyFactory.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface MarginlyFactoryInterface extends utils.Interface {
  functions: {
    'changeSwapRouter(address)': utils.FunctionFragment;
    'createPool(address,address,uint24,tuple)': utils.FunctionFragment;
    'feeHolder()': utils.FunctionFragment;
    'getPool(address,address,uint24)': utils.FunctionFragment;
    'marginlyPoolImplementation()': utils.FunctionFragment;
    'owner()': utils.FunctionFragment;
    'setOwner(address)': utils.FunctionFragment;
    'swapRouter()': utils.FunctionFragment;
    'techPositionOwner()': utils.FunctionFragment;
    'uniswapFactory()': utils.FunctionFragment;
    'WETH9()': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'changeSwapRouter'
      | 'createPool'
      | 'feeHolder'
      | 'getPool'
      | 'marginlyPoolImplementation'
      | 'owner'
      | 'setOwner'
      | 'swapRouter'
      | 'techPositionOwner'
      | 'uniswapFactory'
      | 'WETH9'
  ): utils.FunctionFragment;
}

export interface MarginlyFactoryContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MarginlyFactoryInterface;

  changeSwapRouter(
    newSwapRouter: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  createPool(
    quoteToken: PromiseOrValue<string>,
    baseToken: PromiseOrValue<string>,
    uniswapFee: PromiseOrValue<BigNumberish>,
    params: PromiseOrValue<{
      maxLeverage: BigNumberish;
      priceSecondsAgo: BigNumberish;
      interestRate: BigNumberish;
      fee: BigNumberish;
      swapFee: BigNumberish;
      mcSlippage: BigNumberish;
      positionMinAmount: BigNumberish;
      quoteLimit: BigNumberish;
    }>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  feeHolder(override?: CallOverrides): Promise<string>;
  getPool(
    arg0: PromiseOrValue<string>,
    arg1: PromiseOrValue<string>,
    arg2: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<string>;
  marginlyPoolImplementation(override?: CallOverrides): Promise<string>;
  owner(override?: CallOverrides): Promise<string>;
  setOwner(
    _owner: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  swapRouter(override?: CallOverrides): Promise<string>;
  techPositionOwner(override?: CallOverrides): Promise<string>;
  uniswapFactory(override?: CallOverrides): Promise<string>;
  WETH9(override?: CallOverrides): Promise<string>;

  functions: {
    feeHolder(override?: CallOverrides): Promise<[string]>;
    getPool(
      arg0: PromiseOrValue<string>,
      arg1: PromiseOrValue<string>,
      arg2: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<[string]>;
    marginlyPoolImplementation(override?: CallOverrides): Promise<[string]>;
    owner(override?: CallOverrides): Promise<[string]>;
    swapRouter(override?: CallOverrides): Promise<[string]>;
    techPositionOwner(override?: CallOverrides): Promise<[string]>;
    uniswapFactory(override?: CallOverrides): Promise<[string]>;
    WETH9(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    changeSwapRouter(
      newSwapRouter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    createPool(
      quoteToken: PromiseOrValue<string>,
      baseToken: PromiseOrValue<string>,
      uniswapFee: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        priceSecondsAgo: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    setOwner(
      _owner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    changeSwapRouter(
      newSwapRouter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    createPool(
      quoteToken: PromiseOrValue<string>,
      baseToken: PromiseOrValue<string>,
      uniswapFee: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        priceSecondsAgo: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    setOwner(
      _owner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    changeSwapRouter(
      newSwapRouter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    createPool(
      quoteToken: PromiseOrValue<string>,
      baseToken: PromiseOrValue<string>,
      uniswapFee: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        priceSecondsAgo: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<string>;
    setOwner(_owner: PromiseOrValue<string>, override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
  };
}

export async function deploy(
  _marginlyPoolImplementation: string,
  _uniswapFactory: string,
  _swapRouter: string,
  _feeHolder: string,
  _WETH9: string,
  _techPositionOwner: string,
  signer?: Signer
): Promise<MarginlyFactoryContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(
    _marginlyPoolImplementation,
    _uniswapFactory,
    _swapRouter,
    _feeHolder,
    _WETH9,
    _techPositionOwner
  );
  return (await contract.deployed()) as any;
}

export function connect(
  addressOrName: string,
  signerOrProvider?: Signer | providers.Provider
): MarginlyFactoryContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
