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
import {
  abi,
  bytecode,
} from '@marginly/router/artifacts/contracts/adapters/UniswapV3Adapter.sol/UniswapV3Adapter.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface UniswapV3AdapterInterface extends utils.Interface {
  functions: {
    'addPools(tuple[])': utils.FunctionFragment;
    'getPool(address,address)': utils.FunctionFragment;
    'owner()': utils.FunctionFragment;
    'renounceOwnership()': utils.FunctionFragment;
    'swapExactInput(address,address,address,uint256,uint256,tuple)': utils.FunctionFragment;
    'swapExactOutput(address,address,address,uint256,uint256,tuple)': utils.FunctionFragment;
    'transferOwnership(address)': utils.FunctionFragment;
    'uniswapV3SwapCallback(int256,int256,bytes)': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'addPools'
      | 'getPool'
      | 'owner'
      | 'renounceOwnership'
      | 'swapExactInput'
      | 'swapExactOutput'
      | 'transferOwnership'
      | 'uniswapV3SwapCallback'
  ): utils.FunctionFragment;
}

export interface UniswapV3AdapterContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: UniswapV3AdapterInterface;

  addPools(
    pools: PromiseOrValue<{ token0: string; token1: string; pool: string }[]>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  getPool(arg0: PromiseOrValue<string>, arg1: PromiseOrValue<string>, override?: CallOverrides): Promise<string>;
  owner(override?: CallOverrides): Promise<string>;
  renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  swapExactInput(
    recipient: PromiseOrValue<string>,
    tokenIn: PromiseOrValue<string>,
    tokenOut: PromiseOrValue<string>,
    amountIn: PromiseOrValue<BigNumberish>,
    minAmountOut: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<{ payer: string; tokenIn: string; dexIndex: BigNumberish }>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  swapExactOutput(
    recipient: PromiseOrValue<string>,
    tokenIn: PromiseOrValue<string>,
    tokenOut: PromiseOrValue<string>,
    maxAmountIn: PromiseOrValue<BigNumberish>,
    amountOut: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<{ payer: string; tokenIn: string; dexIndex: BigNumberish }>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  transferOwnership(
    newOwner: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  uniswapV3SwapCallback(
    amount0Delta: PromiseOrValue<BigNumberish>,
    amount1Delta: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {
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
      data: PromiseOrValue<{ payer: string; tokenIn: string; dexIndex: BigNumberish }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    swapExactOutput(
      recipient: PromiseOrValue<string>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      maxAmountIn: PromiseOrValue<BigNumberish>,
      amountOut: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<{ payer: string; tokenIn: string; dexIndex: BigNumberish }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    uniswapV3SwapCallback(
      amount0Delta: PromiseOrValue<BigNumberish>,
      amount1Delta: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
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
      data: PromiseOrValue<{ payer: string; tokenIn: string; dexIndex: BigNumberish }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    swapExactOutput(
      recipient: PromiseOrValue<string>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      maxAmountIn: PromiseOrValue<BigNumberish>,
      amountOut: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<{ payer: string; tokenIn: string; dexIndex: BigNumberish }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    uniswapV3SwapCallback(
      amount0Delta: PromiseOrValue<BigNumberish>,
      amount1Delta: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
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
      data: PromiseOrValue<{ payer: string; tokenIn: string; dexIndex: BigNumberish }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    swapExactOutput(
      recipient: PromiseOrValue<string>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      maxAmountIn: PromiseOrValue<BigNumberish>,
      amountOut: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<{ payer: string; tokenIn: string; dexIndex: BigNumberish }>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    uniswapV3SwapCallback(
      amount0Delta: PromiseOrValue<BigNumberish>,
      amount1Delta: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(
  pools: { token0: string; token1: string; pool: string }[],
  signer?: Signer
): Promise<UniswapV3AdapterContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(pools);
  return (await contract.deployed()) as any;
}

export function connect(
  addressOrName: string,
  signerOrProvider?: Signer | providers.Provider
): UniswapV3AdapterContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
