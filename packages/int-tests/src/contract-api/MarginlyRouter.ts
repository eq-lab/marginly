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
import { abi, bytecode } from '@marginly/router/artifacts/contracts/MarginlyRouter.sol/MarginlyRouter.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface MarginlyRouterInterface extends utils.Interface {
  functions: {
    'adapterCallback(address,uint256,bytes)': utils.FunctionFragment;
    'adapters(uint256)': utils.FunctionFragment;
    'addDexAdapters(tuple[])': utils.FunctionFragment;
    'owner()': utils.FunctionFragment;
    'renounceOwnership()': utils.FunctionFragment;
    'swapExactInput(uint256,address,address,uint256,uint256)': utils.FunctionFragment;
    'swapExactOutput(uint256,address,address,uint256,uint256)': utils.FunctionFragment;
    'transferOwnership(address)': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'adapterCallback'
      | 'adapters'
      | 'addDexAdapters'
      | 'owner'
      | 'renounceOwnership'
      | 'swapExactInput'
      | 'swapExactOutput'
      | 'transferOwnership'
  ): utils.FunctionFragment;
}

export interface MarginlyRouterContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MarginlyRouterInterface;

  adapterCallback(
    recipient: PromiseOrValue<string>,
    amount: PromiseOrValue<BigNumberish>,
    _data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  adapters(arg0: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<string>;
  addDexAdapters(
    _adapters: PromiseOrValue<{ dexIndex: BigNumberish; adapter: string }[]>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  owner(override?: CallOverrides): Promise<string>;
  renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  swapExactInput(
    swapCalldata: PromiseOrValue<BigNumberish>,
    tokenIn: PromiseOrValue<string>,
    tokenOut: PromiseOrValue<string>,
    amountIn: PromiseOrValue<BigNumberish>,
    minAmountOut: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  swapExactOutput(
    swapCalldata: PromiseOrValue<BigNumberish>,
    tokenIn: PromiseOrValue<string>,
    tokenOut: PromiseOrValue<string>,
    maxAmountIn: PromiseOrValue<BigNumberish>,
    amountOut: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  transferOwnership(
    newOwner: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {
    adapters(arg0: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<[string]>;
    owner(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    adapterCallback(
      recipient: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      _data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    addDexAdapters(
      _adapters: PromiseOrValue<{ dexIndex: BigNumberish; adapter: string }[]>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    swapExactInput(
      swapCalldata: PromiseOrValue<BigNumberish>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      amountIn: PromiseOrValue<BigNumberish>,
      minAmountOut: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    swapExactOutput(
      swapCalldata: PromiseOrValue<BigNumberish>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      maxAmountIn: PromiseOrValue<BigNumberish>,
      amountOut: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    adapterCallback(
      recipient: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      _data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    addDexAdapters(
      _adapters: PromiseOrValue<{ dexIndex: BigNumberish; adapter: string }[]>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    swapExactInput(
      swapCalldata: PromiseOrValue<BigNumberish>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      amountIn: PromiseOrValue<BigNumberish>,
      minAmountOut: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    swapExactOutput(
      swapCalldata: PromiseOrValue<BigNumberish>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      maxAmountIn: PromiseOrValue<BigNumberish>,
      amountOut: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    adapterCallback(
      recipient: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      _data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    addDexAdapters(
      _adapters: PromiseOrValue<{ dexIndex: BigNumberish; adapter: string }[]>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    swapExactInput(
      swapCalldata: PromiseOrValue<BigNumberish>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      amountIn: PromiseOrValue<BigNumberish>,
      minAmountOut: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    swapExactOutput(
      swapCalldata: PromiseOrValue<BigNumberish>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      maxAmountIn: PromiseOrValue<BigNumberish>,
      amountOut: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(
  _adapters: { dexIndex: BigNumberish; adapter: string }[],
  signer?: Signer
): Promise<MarginlyRouterContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(_adapters);
  return (await contract.deployed()) as any;
}

export function connect(addressOrName: string, signerOrProvider?: Signer | providers.Provider): MarginlyRouterContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
