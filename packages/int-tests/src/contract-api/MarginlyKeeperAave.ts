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
import { abi, bytecode } from '@marginly/contracts/artifacts/contracts/MarginlyKeeperAave.sol/MarginlyKeeperAave.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface MarginlyKeeperAaveInterface extends utils.Interface {
  functions: {
    'ADDRESSES_PROVIDER()': utils.FunctionFragment;
    'executeOperation(address,uint256,uint256,address,bytes)': utils.FunctionFragment;
    'flashLoan(address,uint256,address,address,uint256,uint256)': utils.FunctionFragment;
    'POOL()': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic: 'ADDRESSES_PROVIDER' | 'executeOperation' | 'flashLoan' | 'POOL'
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
  flashLoan(
    asset: PromiseOrValue<string>,
    amount: PromiseOrValue<BigNumberish>,
    marginlyPool: PromiseOrValue<string>,
    positionToLiquidate: PromiseOrValue<string>,
    minProfit: PromiseOrValue<BigNumberish>,
    swapCallData: PromiseOrValue<BigNumberish>,
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
      marginlyPool: PromiseOrValue<string>,
      positionToLiquidate: PromiseOrValue<string>,
      minProfit: PromiseOrValue<BigNumberish>,
      swapCallData: PromiseOrValue<BigNumberish>,
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
      marginlyPool: PromiseOrValue<string>,
      positionToLiquidate: PromiseOrValue<string>,
      minProfit: PromiseOrValue<BigNumberish>,
      swapCallData: PromiseOrValue<BigNumberish>,
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
      marginlyPool: PromiseOrValue<string>,
      positionToLiquidate: PromiseOrValue<string>,
      minProfit: PromiseOrValue<BigNumberish>,
      swapCallData: PromiseOrValue<BigNumberish>,
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
