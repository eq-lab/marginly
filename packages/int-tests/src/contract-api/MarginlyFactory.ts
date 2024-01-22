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
    'acceptOwnership()': utils.FunctionFragment;
    'changeSwapRouter(address)': utils.FunctionFragment;
    'createPool(address,address,address,uint32,tuple)': utils.FunctionFragment;
    'feeHolder()': utils.FunctionFragment;
    'marginlyPoolImplementation()': utils.FunctionFragment;
    'owner()': utils.FunctionFragment;
    'pendingOwner()': utils.FunctionFragment;
    'renounceOwnership()': utils.FunctionFragment;
    'swapRouter()': utils.FunctionFragment;
    'techPositionOwner()': utils.FunctionFragment;
    'transferOwnership(address)': utils.FunctionFragment;
    'WETH9()': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'acceptOwnership'
      | 'changeSwapRouter'
      | 'createPool'
      | 'feeHolder'
      | 'marginlyPoolImplementation'
      | 'owner'
      | 'pendingOwner'
      | 'renounceOwnership'
      | 'swapRouter'
      | 'techPositionOwner'
      | 'transferOwnership'
      | 'WETH9'
  ): utils.FunctionFragment;
}

export interface MarginlyFactoryContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MarginlyFactoryInterface;

  acceptOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  changeSwapRouter(
    newSwapRouter: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  createPool(
    quoteToken: PromiseOrValue<string>,
    baseToken: PromiseOrValue<string>,
    priceOracle: PromiseOrValue<string>,
    defaultSwapCallData: PromiseOrValue<BigNumberish>,
    params: PromiseOrValue<{
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
  feeHolder(override?: CallOverrides): Promise<string>;
  marginlyPoolImplementation(override?: CallOverrides): Promise<string>;
  owner(override?: CallOverrides): Promise<string>;
  pendingOwner(override?: CallOverrides): Promise<string>;
  renounceOwnership(override?: CallOverrides): Promise<void>;
  swapRouter(override?: CallOverrides): Promise<string>;
  techPositionOwner(override?: CallOverrides): Promise<string>;
  transferOwnership(
    newOwner: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  WETH9(override?: CallOverrides): Promise<string>;

  functions: {
    feeHolder(override?: CallOverrides): Promise<[string]>;
    marginlyPoolImplementation(override?: CallOverrides): Promise<[string]>;
    owner(override?: CallOverrides): Promise<[string]>;
    pendingOwner(override?: CallOverrides): Promise<[string]>;
    renounceOwnership(override?: CallOverrides): Promise<{}>;
    swapRouter(override?: CallOverrides): Promise<[string]>;
    techPositionOwner(override?: CallOverrides): Promise<[string]>;
    WETH9(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    acceptOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    changeSwapRouter(
      newSwapRouter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    createPool(
      quoteToken: PromiseOrValue<string>,
      baseToken: PromiseOrValue<string>,
      priceOracle: PromiseOrValue<string>,
      defaultSwapCallData: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<{
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
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    acceptOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    changeSwapRouter(
      newSwapRouter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    createPool(
      quoteToken: PromiseOrValue<string>,
      baseToken: PromiseOrValue<string>,
      priceOracle: PromiseOrValue<string>,
      defaultSwapCallData: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<{
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
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    acceptOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    changeSwapRouter(
      newSwapRouter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    createPool(
      quoteToken: PromiseOrValue<string>,
      baseToken: PromiseOrValue<string>,
      priceOracle: PromiseOrValue<string>,
      defaultSwapCallData: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<{
        maxLeverage: BigNumberish;
        interestRate: BigNumberish;
        fee: BigNumberish;
        swapFee: BigNumberish;
        mcSlippage: BigNumberish;
        positionMinAmount: BigNumberish;
        quoteLimit: BigNumberish;
      }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<string>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(
  _marginlyPoolImplementation: string,
  _swapRouter: string,
  _feeHolder: string,
  _WETH9: string,
  _techPositionOwner: string,
  signer?: Signer
): Promise<MarginlyFactoryContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(
    _marginlyPoolImplementation,
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
