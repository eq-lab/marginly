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
import { abi, bytecode } from '@marginly/contracts/artifacts/contracts/MarginlyKeeper.sol/MarginlyKeeper.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface MarginlyKeeperInterface extends utils.Interface {
  functions: {
    'ADDRESSES_PROVIDER()': utils.FunctionFragment;
    'executeOperation(address,uint256,uint256,address,bytes)': utils.FunctionFragment;
    'flashLoan(address,uint256,uint16,address,address,uint256)': utils.FunctionFragment;
    'POOL()': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic: 'ADDRESSES_PROVIDER' | 'executeOperation' | 'flashLoan' | 'POOL'
  ): utils.FunctionFragment;
}

export interface MarginlyKeeperContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MarginlyKeeperInterface;

  ADDRESSES_PROVIDER(override?: CallOverrides): Promise<string>;
  executeOperation(
    asset: PromiseOrValue<string>,
    amount: PromiseOrValue<BigNumberish>,
    premium: PromiseOrValue<BigNumberish>,
    initiator: PromiseOrValue<string>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  flashLoan(
    asset: PromiseOrValue<string>,
    amount: PromiseOrValue<BigNumberish>,
    referralCode: PromiseOrValue<BigNumberish>,
    marginlyPool: PromiseOrValue<string>,
    positionToLiquidate: PromiseOrValue<string>,
    minProfit: PromiseOrValue<BigNumberish>,
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
    flashLoan(
      asset: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      referralCode: PromiseOrValue<BigNumberish>,
      marginlyPool: PromiseOrValue<string>,
      positionToLiquidate: PromiseOrValue<string>,
      minProfit: PromiseOrValue<BigNumberish>,
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
    flashLoan(
      asset: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      referralCode: PromiseOrValue<BigNumberish>,
      marginlyPool: PromiseOrValue<string>,
      positionToLiquidate: PromiseOrValue<string>,
      minProfit: PromiseOrValue<BigNumberish>,
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
    flashLoan(
      asset: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      referralCode: PromiseOrValue<BigNumberish>,
      marginlyPool: PromiseOrValue<string>,
      positionToLiquidate: PromiseOrValue<string>,
      minProfit: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(addressesProvider: string, signer?: Signer): Promise<MarginlyKeeperContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(addressesProvider);
  return (await contract.deployed()) as any;
}

export function connect(addressOrName: string, signerOrProvider?: Signer | providers.Provider): MarginlyKeeperContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
