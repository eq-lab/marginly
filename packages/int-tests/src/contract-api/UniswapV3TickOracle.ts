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
} from '@marginly/periphery/artifacts/contracts/oracles/UniswapV3TickOracle.sol/UniswapV3TickOracle.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface UniswapV3TickOracleInterface extends utils.Interface {
  functions: {
    'acceptOwnership()': utils.FunctionFragment;
    'factory()': utils.FunctionFragment;
    'getBalancePrice(address,address)': utils.FunctionFragment;
    'getMargincallPrice(address,address)': utils.FunctionFragment;
    'getParamsEncoded(address,address)': utils.FunctionFragment;
    'owner()': utils.FunctionFragment;
    'pendingOwner()': utils.FunctionFragment;
    'renounceOwnership()': utils.FunctionFragment;
    'setOptions(address,address,bytes)': utils.FunctionFragment;
    'transferOwnership(address)': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'acceptOwnership'
      | 'factory'
      | 'getBalancePrice'
      | 'getMargincallPrice'
      | 'getParamsEncoded'
      | 'owner'
      | 'pendingOwner'
      | 'renounceOwnership'
      | 'setOptions'
      | 'transferOwnership'
  ): utils.FunctionFragment;
}

export interface UniswapV3TickOracleContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: UniswapV3TickOracleInterface;

  acceptOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  factory(override?: CallOverrides): Promise<string>;
  getBalancePrice(
    quoteToken: PromiseOrValue<string>,
    baseToken: PromiseOrValue<string>,
    override?: CallOverrides
  ): Promise<BigNumber>;
  getMargincallPrice(
    quoteToken: PromiseOrValue<string>,
    baseToken: PromiseOrValue<string>,
    override?: CallOverrides
  ): Promise<BigNumber>;
  getParamsEncoded(
    arg0: PromiseOrValue<string>,
    arg1: PromiseOrValue<string>,
    override?: CallOverrides
  ): Promise<BytesLike>;
  owner(override?: CallOverrides): Promise<string>;
  pendingOwner(override?: CallOverrides): Promise<string>;
  renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  setOptions(
    quoteToken: PromiseOrValue<string>,
    baseToken: PromiseOrValue<string>,
    encodedParams: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  transferOwnership(
    newOwner: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {
    factory(override?: CallOverrides): Promise<[string]>;
    getBalancePrice(
      quoteToken: PromiseOrValue<string>,
      baseToken: PromiseOrValue<string>,
      override?: CallOverrides
    ): Promise<[BigNumber]>;
    getMargincallPrice(
      quoteToken: PromiseOrValue<string>,
      baseToken: PromiseOrValue<string>,
      override?: CallOverrides
    ): Promise<[BigNumber]>;
    getParamsEncoded(
      arg0: PromiseOrValue<string>,
      arg1: PromiseOrValue<string>,
      override?: CallOverrides
    ): Promise<[BytesLike]>;
    owner(override?: CallOverrides): Promise<[string]>;
    pendingOwner(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    acceptOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    setOptions(
      quoteToken: PromiseOrValue<string>,
      baseToken: PromiseOrValue<string>,
      encodedParams: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    acceptOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    setOptions(
      quoteToken: PromiseOrValue<string>,
      baseToken: PromiseOrValue<string>,
      encodedParams: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    acceptOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    renounceOwnership(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    setOptions(
      quoteToken: PromiseOrValue<string>,
      baseToken: PromiseOrValue<string>,
      encodedParams: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(_factory: string, signer?: Signer): Promise<UniswapV3TickOracleContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(_factory);
  return (await contract.deployed()) as any;
}

export function connect(
  addressOrName: string,
  signerOrProvider?: Signer | providers.Provider
): UniswapV3TickOracleContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
