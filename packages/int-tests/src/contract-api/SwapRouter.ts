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
import { abi, bytecode } from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface SwapRouterInterface extends utils.Interface {
  functions: {
    'exactInput(tuple)': utils.FunctionFragment;
    'exactInputSingle(tuple)': utils.FunctionFragment;
    'exactOutput(tuple)': utils.FunctionFragment;
    'exactOutputSingle(tuple)': utils.FunctionFragment;
    'uniswapV3SwapCallback(int256,int256,bytes)': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'exactInput'
      | 'exactInputSingle'
      | 'exactOutput'
      | 'exactOutputSingle'
      | 'uniswapV3SwapCallback'
  ): utils.FunctionFragment;
}

export interface SwapRouterContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: SwapRouterInterface;

  exactInput(
    params: {
      path: BytesLike;
      recipient: string;
      deadline: BigNumberish;
      amountIn: BigNumberish;
      amountOutMinimum: BigNumberish;
    },
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  exactInputSingle(
    params: {
      tokenIn: string;
      tokenOut: string;
      fee: BigNumberish;
      recipient: string;
      deadline: BigNumberish;
      amountIn: BigNumberish;
      amountOutMinimum: BigNumberish;
      sqrtPriceLimitX96: BigNumberish;
    },
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  exactOutput(
    params: {
      path: BytesLike;
      recipient: string;
      deadline: BigNumberish;
      amountOut: BigNumberish;
      amountInMaximum: BigNumberish;
    },
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  exactOutputSingle(
    params: {
      tokenIn: string;
      tokenOut: string;
      fee: BigNumberish;
      recipient: string;
      deadline: BigNumberish;
      amountOut: BigNumberish;
      amountInMaximum: BigNumberish;
      sqrtPriceLimitX96: BigNumberish;
    },
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  uniswapV3SwapCallback(
    amount0Delta: PromiseOrValue<BigNumberish>,
    amount1Delta: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {};
  estimateGas: {
    exactInput(
      params: {
        path: BytesLike;
        recipient: string;
        deadline: BigNumberish;
        amountIn: BigNumberish;
        amountOutMinimum: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    exactInputSingle(
      params: {
        tokenIn: string;
        tokenOut: string;
        fee: BigNumberish;
        recipient: string;
        deadline: BigNumberish;
        amountIn: BigNumberish;
        amountOutMinimum: BigNumberish;
        sqrtPriceLimitX96: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    exactOutput(
      params: {
        path: BytesLike;
        recipient: string;
        deadline: BigNumberish;
        amountOut: BigNumberish;
        amountInMaximum: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    exactOutputSingle(
      params: {
        tokenIn: string;
        tokenOut: string;
        fee: BigNumberish;
        recipient: string;
        deadline: BigNumberish;
        amountOut: BigNumberish;
        amountInMaximum: BigNumberish;
        sqrtPriceLimitX96: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    uniswapV3SwapCallback(
      amount0Delta: PromiseOrValue<BigNumberish>,
      amount1Delta: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    exactInput(
      params: {
        path: BytesLike;
        recipient: string;
        deadline: BigNumberish;
        amountIn: BigNumberish;
        amountOutMinimum: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    exactInputSingle(
      params: {
        tokenIn: string;
        tokenOut: string;
        fee: BigNumberish;
        recipient: string;
        deadline: BigNumberish;
        amountIn: BigNumberish;
        amountOutMinimum: BigNumberish;
        sqrtPriceLimitX96: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    exactOutput(
      params: {
        path: BytesLike;
        recipient: string;
        deadline: BigNumberish;
        amountOut: BigNumberish;
        amountInMaximum: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    exactOutputSingle(
      params: {
        tokenIn: string;
        tokenOut: string;
        fee: BigNumberish;
        recipient: string;
        deadline: BigNumberish;
        amountOut: BigNumberish;
        amountInMaximum: BigNumberish;
        sqrtPriceLimitX96: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    uniswapV3SwapCallback(
      amount0Delta: PromiseOrValue<BigNumberish>,
      amount1Delta: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    exactInput(
      params: {
        path: BytesLike;
        recipient: string;
        deadline: BigNumberish;
        amountIn: BigNumberish;
        amountOutMinimum: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    exactInputSingle(
      params: {
        tokenIn: string;
        tokenOut: string;
        fee: BigNumberish;
        recipient: string;
        deadline: BigNumberish;
        amountIn: BigNumberish;
        amountOutMinimum: BigNumberish;
        sqrtPriceLimitX96: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    exactOutput(
      params: {
        path: BytesLike;
        recipient: string;
        deadline: BigNumberish;
        amountOut: BigNumberish;
        amountInMaximum: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    exactOutputSingle(
      params: {
        tokenIn: string;
        tokenOut: string;
        fee: BigNumberish;
        recipient: string;
        deadline: BigNumberish;
        amountOut: BigNumberish;
        amountInMaximum: BigNumberish;
        sqrtPriceLimitX96: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    uniswapV3SwapCallback(
      amount0Delta: PromiseOrValue<BigNumberish>,
      amount1Delta: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(signer?: Signer): Promise<SwapRouterContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  return (await contract.deployed()) as any;
}

export function connect(addressOrName: string, signerOrProvider?: Signer | providers.Provider): SwapRouterContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
