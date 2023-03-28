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
import { abi, bytecode } from '@uniswap/v2-periphery/build/WETH9.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface WETH9Interface extends utils.Interface {
  functions: {
    'allowance(address,address)': utils.FunctionFragment;
    'approve(address,uint256)': utils.FunctionFragment;
    'balanceOf(address)': utils.FunctionFragment;
    'decimals()': utils.FunctionFragment;
    'deposit()': utils.FunctionFragment;
    'name()': utils.FunctionFragment;
    'symbol()': utils.FunctionFragment;
    'totalSupply()': utils.FunctionFragment;
    'transfer(address,uint256)': utils.FunctionFragment;
    'transferFrom(address,address,uint256)': utils.FunctionFragment;
    'withdraw(uint256)': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'allowance'
      | 'approve'
      | 'balanceOf'
      | 'decimals'
      | 'deposit'
      | 'name'
      | 'symbol'
      | 'totalSupply'
      | 'transfer'
      | 'transferFrom'
      | 'withdraw'
  ): utils.FunctionFragment;
}

export interface WETH9Contract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: WETH9Interface;

  allowance(
    arg0: PromiseOrValue<string>,
    arg1: PromiseOrValue<string>,
    override?: CallOverrides
  ): Promise<BigNumberish>;
  approve(
    guy: PromiseOrValue<string>,
    wad: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  balanceOf(arg0: PromiseOrValue<string>, override?: CallOverrides): Promise<BigNumberish>;
  decimals(override?: CallOverrides): Promise<BigNumberish>;
  deposit(override?: PayableOverrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  name(override?: CallOverrides): Promise<string>;
  symbol(override?: CallOverrides): Promise<string>;
  totalSupply(override?: CallOverrides): Promise<BigNumberish>;
  transfer(
    dst: PromiseOrValue<string>,
    wad: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  transferFrom(
    src: PromiseOrValue<string>,
    dst: PromiseOrValue<string>,
    wad: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  withdraw(
    wad: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {
    allowance(
      arg0: PromiseOrValue<string>,
      arg1: PromiseOrValue<string>,
      override?: CallOverrides
    ): Promise<[BigNumberish]>;
    balanceOf(arg0: PromiseOrValue<string>, override?: CallOverrides): Promise<[BigNumberish]>;
    decimals(override?: CallOverrides): Promise<[BigNumberish]>;
    name(override?: CallOverrides): Promise<[string]>;
    symbol(override?: CallOverrides): Promise<[string]>;
    totalSupply(override?: CallOverrides): Promise<[BigNumberish]>;
  };
  estimateGas: {
    approve(
      guy: PromiseOrValue<string>,
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    deposit(override?: PayableOverrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    transfer(
      dst: PromiseOrValue<string>,
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferFrom(
      src: PromiseOrValue<string>,
      dst: PromiseOrValue<string>,
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    withdraw(
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    approve(
      guy: PromiseOrValue<string>,
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    deposit(override?: PayableOverrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    transfer(
      dst: PromiseOrValue<string>,
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transferFrom(
      src: PromiseOrValue<string>,
      dst: PromiseOrValue<string>,
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    withdraw(
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    approve(
      guy: PromiseOrValue<string>,
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    deposit(override?: PayableOverrides & { from?: PromiseOrValue<string> }): Promise<void>;
    transfer(
      dst: PromiseOrValue<string>,
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    transferFrom(
      src: PromiseOrValue<string>,
      dst: PromiseOrValue<string>,
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    withdraw(
      wad: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(signer?: Signer): Promise<WETH9Contract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  return (await contract.deployed()) as any;
}

export function connect(addressOrName: string, signerOrProvider?: Signer | providers.Provider): WETH9Contract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
