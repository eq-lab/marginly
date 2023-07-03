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
    'dexPoolMapping(uint8,address,address)': utils.FunctionFragment;
    'owner()': utils.FunctionFragment;
    'renounceOwnership()': utils.FunctionFragment;
    'swapExactInput(bytes,address,address,uint256,uint256)': utils.FunctionFragment;
    'swapExactOutput(bytes,address,address,uint256,uint256)': utils.FunctionFragment;
    'transferOwnership(address)': utils.FunctionFragment;
    'uniswapV3SwapCallback(int256,int256,bytes)': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'dexPoolMapping'
      | 'owner'
      | 'renounceOwnership'
      | 'swapExactInput'
      | 'swapExactOutput'
      | 'transferOwnership'
      | 'uniswapV3SwapCallback'
  ): utils.FunctionFragment;
}

export interface MarginlyRouterContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MarginlyRouterInterface;

  dexPoolMapping(
    arg0: PromiseOrValue<BigNumberish>,
    arg1: PromiseOrValue<string>,
    arg2: PromiseOrValue<string>,
    override?: CallOverrides
  ): Promise<{ fee: BigNumber; pool: string }>;
  owner(override?: CallOverrides): Promise<string>;
  renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  swapExactInput(
    swapCalldata: PromiseOrValue<BytesLike>,
    tokenIn: PromiseOrValue<string>,
    tokenOut: PromiseOrValue<string>,
    amountIn: PromiseOrValue<BigNumberish>,
    minAmountOut: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  swapExactOutput(
    swapCalldata: PromiseOrValue<BytesLike>,
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
  uniswapV3SwapCallback(
    amount0Delta: PromiseOrValue<BigNumberish>,
    amount1Delta: PromiseOrValue<BigNumberish>,
    _data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {
    dexPoolMapping(
      arg0: PromiseOrValue<BigNumberish>,
      arg1: PromiseOrValue<string>,
      arg2: PromiseOrValue<string>,
      override?: CallOverrides
    ): Promise<{ fee: BigNumber; pool: string }>;
    owner(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    swapExactInput(
      swapCalldata: PromiseOrValue<BytesLike>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      amountIn: PromiseOrValue<BigNumberish>,
      minAmountOut: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    swapExactOutput(
      swapCalldata: PromiseOrValue<BytesLike>,
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
    uniswapV3SwapCallback(
      amount0Delta: PromiseOrValue<BigNumberish>,
      amount1Delta: PromiseOrValue<BigNumberish>,
      _data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    swapExactInput(
      swapCalldata: PromiseOrValue<BytesLike>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      amountIn: PromiseOrValue<BigNumberish>,
      minAmountOut: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    swapExactOutput(
      swapCalldata: PromiseOrValue<BytesLike>,
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
    uniswapV3SwapCallback(
      amount0Delta: PromiseOrValue<BigNumberish>,
      amount1Delta: PromiseOrValue<BigNumberish>,
      _data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    swapExactInput(
      swapCalldata: PromiseOrValue<BytesLike>,
      tokenIn: PromiseOrValue<string>,
      tokenOut: PromiseOrValue<string>,
      amountIn: PromiseOrValue<BigNumberish>,
      minAmountOut: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    swapExactOutput(
      swapCalldata: PromiseOrValue<BytesLike>,
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
    uniswapV3SwapCallback(
      amount0Delta: PromiseOrValue<BigNumberish>,
      amount1Delta: PromiseOrValue<BigNumberish>,
      _data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(
  pools: { dex: BigNumberish; fee: BigNumberish; token0: string; token1: string; pool: string }[],
  signer?: Signer
): Promise<MarginlyRouterContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(pools);
  return (await contract.deployed()) as any;
}

export function connect(addressOrName: string, signerOrProvider?: Signer | providers.Provider): MarginlyRouterContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
