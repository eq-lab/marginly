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
import { abi, bytecode } from '@marginly/router/artifacts/contracts/adapters/BalancerAdapter.sol/BalancerAdapter.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface BalancerAdapterInterface extends utils.Interface {
  functions: {
    'addPools(tuple[])': utils.FunctionFragment;
    'balancerVault()': utils.FunctionFragment;
    'getPool(address,address)': utils.FunctionFragment;
    'owner()': utils.FunctionFragment;
    'renounceOwnership()': utils.FunctionFragment;
    'swapExactInput(address,address,address,uint256,uint256,bytes)': utils.FunctionFragment;
    'swapExactOutput(address,address,address,uint256,uint256,bytes)': utils.FunctionFragment;
    'transferOwnership(address)': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'addPools'
      | 'balancerVault'
      | 'getPool'
      | 'owner'
      | 'renounceOwnership'
      | 'swapExactInput'
      | 'swapExactOutput'
      | 'transferOwnership'
  ): utils.FunctionFragment;
}

export interface BalancerAdapterContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: BalancerAdapterInterface;

  addPools(
    pools: PromiseOrValue<{ token0: string; token1: string; pool: string }[]>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  balancerVault(override?: CallOverrides): Promise<string>;
  getPool(arg0: PromiseOrValue<string>, arg1: PromiseOrValue<string>, override?: CallOverrides): Promise<string>;
  owner(override?: CallOverrides): Promise<string>;
  renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  swapExactInput(
    recipient: PromiseOrValue<string>,
    tokenIn: PromiseOrValue<string>,
    tokenOut: PromiseOrValue<string>,
    amountIn: PromiseOrValue<BigNumberish>,
    minAmountOut: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  swapExactOutput(
    recipient: PromiseOrValue<string>,
    tokenIn: PromiseOrValue<string>,
    tokenOut: PromiseOrValue<string>,
    maxAmountIn: PromiseOrValue<BigNumberish>,
    amountOut: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  transferOwnership(
    newOwner: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {
    balancerVault(override?: CallOverrides): Promise<[string]>;
    getPool(arg0: PromiseOrValue<string>, arg1: PromiseOrValue<string>, override?: CallOverrides): Promise<[string]>;
    owner(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    addPools(
      pools: PromiseOrValue<{ token0: string; token1: string; pool: string }[]>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    swapExactInput(
      recipient: PromiseOrValue<string>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      amountIn: PromiseOrValue<BigNumberish>,
      minAmountOut: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    swapExactOutput(
      recipient: PromiseOrValue<string>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      maxAmountIn: PromiseOrValue<BigNumberish>,
      amountOut: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    addPools(
      pools: PromiseOrValue<{ token0: string; token1: string; pool: string }[]>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    swapExactInput(
      recipient: PromiseOrValue<string>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      amountIn: PromiseOrValue<BigNumberish>,
      minAmountOut: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    swapExactOutput(
      recipient: PromiseOrValue<string>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      maxAmountIn: PromiseOrValue<BigNumberish>,
      amountOut: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    addPools(
      pools: PromiseOrValue<{ token0: string; token1: string; pool: string }[]>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    swapExactInput(
      recipient: PromiseOrValue<string>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      amountIn: PromiseOrValue<BigNumberish>,
      minAmountOut: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    swapExactOutput(
      recipient: PromiseOrValue<string>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      maxAmountIn: PromiseOrValue<BigNumberish>,
      amountOut: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(
  pools: { token0: string; token1: string; pool: string }[],
  _balancerVault: string,
  signer?: Signer
): Promise<BalancerAdapterContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(pools, _balancerVault);
  return (await contract.deployed()) as any;
}

export function connect(
  addressOrName: string,
  signerOrProvider?: Signer | providers.Provider
): BalancerAdapterContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
