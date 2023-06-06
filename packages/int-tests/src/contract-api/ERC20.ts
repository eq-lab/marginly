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
import { abi, bytecode } from '@openzeppelin/contracts/build/contracts/ERC20.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface ERC20Interface extends utils.Interface {
  functions: {
    'allowance(address,address)': utils.FunctionFragment;
    'approve(address,uint256)': utils.FunctionFragment;
    'balanceOf(address)': utils.FunctionFragment;
    'decimals()': utils.FunctionFragment;
    'decreaseAllowance(address,uint256)': utils.FunctionFragment;
    'increaseAllowance(address,uint256)': utils.FunctionFragment;
    'name()': utils.FunctionFragment;
    'symbol()': utils.FunctionFragment;
    'totalSupply()': utils.FunctionFragment;
    'transfer(address,uint256)': utils.FunctionFragment;
    'transferFrom(address,address,uint256)': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'allowance'
      | 'approve'
      | 'balanceOf'
      | 'decimals'
      | 'decreaseAllowance'
      | 'increaseAllowance'
      | 'name'
      | 'symbol'
      | 'totalSupply'
      | 'transfer'
      | 'transferFrom'
  ): utils.FunctionFragment;
}

export interface ERC20Contract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: ERC20Interface;

  allowance(
    owner: PromiseOrValue<string>,
    spender: PromiseOrValue<string>,
    override?: CallOverrides
  ): Promise<BigNumber>;
  approve(
    spender: PromiseOrValue<string>,
    amount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  balanceOf(account: PromiseOrValue<string>, override?: CallOverrides): Promise<BigNumber>;
  decimals(override?: CallOverrides): Promise<number>;
  decreaseAllowance(
    spender: PromiseOrValue<string>,
    subtractedValue: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  increaseAllowance(
    spender: PromiseOrValue<string>,
    addedValue: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  name(override?: CallOverrides): Promise<string>;
  symbol(override?: CallOverrides): Promise<string>;
  totalSupply(override?: CallOverrides): Promise<BigNumber>;
  transfer(
    to: PromiseOrValue<string>,
    amount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  transferFrom(
    from: PromiseOrValue<string>,
    to: PromiseOrValue<string>,
    amount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {
    allowance(
      owner: PromiseOrValue<string>,
      spender: PromiseOrValue<string>,
      override?: CallOverrides
    ): Promise<[BigNumber]>;
    balanceOf(account: PromiseOrValue<string>, override?: CallOverrides): Promise<[BigNumber]>;
    decimals(override?: CallOverrides): Promise<[number]>;
    name(override?: CallOverrides): Promise<[string]>;
    symbol(override?: CallOverrides): Promise<[string]>;
    totalSupply(override?: CallOverrides): Promise<[BigNumber]>;
  };
  estimateGas: {
    approve(
      spender: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    decreaseAllowance(
      spender: PromiseOrValue<string>,
      subtractedValue: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    increaseAllowance(
      spender: PromiseOrValue<string>,
      addedValue: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transfer(
      to: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    approve(
      spender: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    decreaseAllowance(
      spender: PromiseOrValue<string>,
      subtractedValue: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    increaseAllowance(
      spender: PromiseOrValue<string>,
      addedValue: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transfer(
      to: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    approve(
      spender: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    decreaseAllowance(
      spender: PromiseOrValue<string>,
      subtractedValue: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    increaseAllowance(
      spender: PromiseOrValue<string>,
      addedValue: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    transfer(
      to: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    transferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
  };
}

export async function deploy(name_: string, symbol_: string, signer?: Signer): Promise<ERC20Contract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(name_, symbol_);
  return (await contract.deployed()) as any;
}

export function connect(addressOrName: string, signerOrProvider?: Signer | providers.Provider): ERC20Contract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
