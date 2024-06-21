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
} from '@marginly/contracts/artifacts/contracts/keepers/MarginlyKeeperAlgebra.sol/MarginlyKeeperAlgebra.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface MarginlyKeeperAlgebraInterface extends utils.Interface {
  functions: {
    'algebraFlashCallback(uint256,uint256,bytes)': utils.FunctionFragment;
    'liquidatePosition(address,uint256,uint256,bytes)': utils.FunctionFragment;
  };

  getFunction(nameOrSignatureOrTopic: 'algebraFlashCallback' | 'liquidatePosition'): utils.FunctionFragment;
}

export interface MarginlyKeeperAlgebraContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MarginlyKeeperAlgebraInterface;

  algebraFlashCallback(
    fee0: PromiseOrValue<BigNumberish>,
    fee1: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  liquidatePosition(
    algebraPool: PromiseOrValue<string>,
    amount0: PromiseOrValue<BigNumberish>,
    amount1: PromiseOrValue<BigNumberish>,
    params: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {};
  estimateGas: {
    algebraFlashCallback(
      fee0: PromiseOrValue<BigNumberish>,
      fee1: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    liquidatePosition(
      algebraPool: PromiseOrValue<string>,
      amount0: PromiseOrValue<BigNumberish>,
      amount1: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    algebraFlashCallback(
      fee0: PromiseOrValue<BigNumberish>,
      fee1: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    liquidatePosition(
      algebraPool: PromiseOrValue<string>,
      amount0: PromiseOrValue<BigNumberish>,
      amount1: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    algebraFlashCallback(
      fee0: PromiseOrValue<BigNumberish>,
      fee1: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    liquidatePosition(
      algebraPool: PromiseOrValue<string>,
      amount0: PromiseOrValue<BigNumberish>,
      amount1: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(signer?: Signer): Promise<MarginlyKeeperAlgebraContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  return (await contract.deployed()) as any;
}

export function connect(
  addressOrName: string,
  signerOrProvider?: Signer | providers.Provider
): MarginlyKeeperAlgebraContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
