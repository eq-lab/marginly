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
} from '@marginly/contracts/artifacts/contracts/MarginlyKeeperUniswapV3.sol/MarginlyKeeperUniswapV3.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface MarginlyKeeperUniswapV3Interface extends utils.Interface {
  functions: {
    'liquidatePosition(address,uint256,uint256,bytes)': utils.FunctionFragment;
    'uniswapV3FlashCallback(uint256,uint256,bytes)': utils.FunctionFragment;
  };

  getFunction(nameOrSignatureOrTopic: 'liquidatePosition' | 'uniswapV3FlashCallback'): utils.FunctionFragment;
}

export interface MarginlyKeeperUniswapV3Contract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MarginlyKeeperUniswapV3Interface;

  liquidatePosition(
    uniswapPool: PromiseOrValue<string>,
    amount0: PromiseOrValue<BigNumberish>,
    amount1: PromiseOrValue<BigNumberish>,
    params: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  uniswapV3FlashCallback(
    fee0: PromiseOrValue<BigNumberish>,
    fee1: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {};
  estimateGas: {
    liquidatePosition(
      uniswapPool: PromiseOrValue<string>,
      amount0: PromiseOrValue<BigNumberish>,
      amount1: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    uniswapV3FlashCallback(
      fee0: PromiseOrValue<BigNumberish>,
      fee1: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    liquidatePosition(
      uniswapPool: PromiseOrValue<string>,
      amount0: PromiseOrValue<BigNumberish>,
      amount1: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    uniswapV3FlashCallback(
      fee0: PromiseOrValue<BigNumberish>,
      fee1: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    liquidatePosition(
      uniswapPool: PromiseOrValue<string>,
      amount0: PromiseOrValue<BigNumberish>,
      amount1: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    uniswapV3FlashCallback(
      fee0: PromiseOrValue<BigNumberish>,
      fee1: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(signer?: Signer): Promise<MarginlyKeeperUniswapV3Contract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  return (await contract.deployed()) as any;
}

export function connect(
  addressOrName: string,
  signerOrProvider?: Signer | providers.Provider
): MarginlyKeeperUniswapV3Contract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
