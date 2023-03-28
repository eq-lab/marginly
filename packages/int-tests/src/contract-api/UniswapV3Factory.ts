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
import { abi, bytecode } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface UniswapV3FactoryInterface extends utils.Interface {
  functions: {
    'createPool(address,address,uint24)': utils.FunctionFragment;
    'enableFeeAmount(uint24,int24)': utils.FunctionFragment;
    'feeAmountTickSpacing(uint24)': utils.FunctionFragment;
    'getPool(address,address,uint24)': utils.FunctionFragment;
    'owner()': utils.FunctionFragment;
    'setOwner(address)': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic: 'createPool' | 'enableFeeAmount' | 'feeAmountTickSpacing' | 'getPool' | 'owner' | 'setOwner'
  ): utils.FunctionFragment;
}

export interface UniswapV3FactoryContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: UniswapV3FactoryInterface;

  createPool(
    tokenA: PromiseOrValue<string>,
    tokenB: PromiseOrValue<string>,
    fee: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  enableFeeAmount(
    fee: PromiseOrValue<BigNumberish>,
    tickSpacing: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  feeAmountTickSpacing(fee: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<BigNumberish>;
  getPool(
    tokenA: PromiseOrValue<string>,
    tokenB: PromiseOrValue<string>,
    fee: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<string>;
  owner(override?: CallOverrides): Promise<string>;
  setOwner(
    _owner: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {
    feeAmountTickSpacing(fee: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<[BigNumberish]>;
    getPool(
      tokenA: PromiseOrValue<string>,
      tokenB: PromiseOrValue<string>,
      fee: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<{ pool: string }>;
    owner(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    createPool(
      tokenA: PromiseOrValue<string>,
      tokenB: PromiseOrValue<string>,
      fee: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    enableFeeAmount(
      fee: PromiseOrValue<BigNumberish>,
      tickSpacing: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    setOwner(
      _owner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    createPool(
      tokenA: PromiseOrValue<string>,
      tokenB: PromiseOrValue<string>,
      fee: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    enableFeeAmount(
      fee: PromiseOrValue<BigNumberish>,
      tickSpacing: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    setOwner(
      _owner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    createPool(
      tokenA: PromiseOrValue<string>,
      tokenB: PromiseOrValue<string>,
      fee: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<string>;
    enableFeeAmount(
      fee: PromiseOrValue<BigNumberish>,
      tickSpacing: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    setOwner(_owner: PromiseOrValue<string>, override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
  };
}

export async function deploy(signer?: Signer): Promise<UniswapV3FactoryContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  return (await contract.deployed()) as any;
}

export function connect(
  addressOrName: string,
  signerOrProvider?: Signer | providers.Provider
): UniswapV3FactoryContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
