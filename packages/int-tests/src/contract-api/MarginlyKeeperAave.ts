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
} from '@marginly/contracts/artifacts/contracts/keepers/MarginlyKeeperAave.sol/MarginlyKeeperAave.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface MarginlyKeeperAaveInterface extends utils.Interface {
  functions: {
    'ADDRESSES_PROVIDER()': utils.FunctionFragment;
    'executeOperation(address,uint256,uint256,address,bytes)': utils.FunctionFragment;
    'liquidatePosition(address,uint256,bytes)': utils.FunctionFragment;
    'POOL()': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic: 'ADDRESSES_PROVIDER' | 'executeOperation' | 'liquidatePosition' | 'POOL'
  ): utils.FunctionFragment;
}

export interface MarginlyKeeperAaveContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MarginlyKeeperAaveInterface;

  ADDRESSES_PROVIDER(override?: CallOverrides): Promise<string>;
  executeOperation(
    asset: PromiseOrValue<string>,
    amount: PromiseOrValue<BigNumberish>,
    premium: PromiseOrValue<BigNumberish>,
    initiator: PromiseOrValue<string>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  liquidatePosition(
    asset: PromiseOrValue<string>,
    amount: PromiseOrValue<BigNumberish>,
    params: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  POOL(override?: CallOverrides): Promise<string>;

  functions: {
    ADDRESSES_PROVIDER(override?: CallOverrides): Promise<[string]>;
    POOL(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    executeOperation(
      asset: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      premium: PromiseOrValue<BigNumberish>,
      initiator: PromiseOrValue<string>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    liquidatePosition(
      asset: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    executeOperation(
      asset: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      premium: PromiseOrValue<BigNumberish>,
      initiator: PromiseOrValue<string>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    liquidatePosition(
      asset: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    executeOperation(
      asset: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      premium: PromiseOrValue<BigNumberish>,
      initiator: PromiseOrValue<string>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    liquidatePosition(
      asset: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(addressesProvider: string, signer?: Signer): Promise<MarginlyKeeperAaveContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(addressesProvider);
  return (await contract.deployed()) as any;
}

export function connect(
  addressOrName: string,
  signerOrProvider?: Signer | providers.Provider
): MarginlyKeeperAaveContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
