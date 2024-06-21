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
} from '@marginly/contracts/artifacts/contracts/keepers/MarginlyKeeperBalancer.sol/MarginlyKeeperBalancer.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface MarginlyKeeperBalancerInterface extends utils.Interface {
  functions: {
    'balancerVault()': utils.FunctionFragment;
    'liquidatePosition(address,uint256,bytes)': utils.FunctionFragment;
    'receiveFlashLoan(address[],uint256[],uint256[],bytes)': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic: 'balancerVault' | 'liquidatePosition' | 'receiveFlashLoan'
  ): utils.FunctionFragment;
}

export interface MarginlyKeeperBalancerContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: MarginlyKeeperBalancerInterface;

  balancerVault(override?: CallOverrides): Promise<string>;
  liquidatePosition(
    token: PromiseOrValue<string>,
    amount: PromiseOrValue<BigNumberish>,
    params: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  receiveFlashLoan(
    tokens: PromiseOrValue<void>,
    amounts: PromiseOrValue<BigNumberish>,
    feeAmounts: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  functions: {
    balancerVault(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    liquidatePosition(
      token: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    receiveFlashLoan(
      tokens: PromiseOrValue<void>,
      amounts: PromiseOrValue<BigNumberish>,
      feeAmounts: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    liquidatePosition(
      token: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    receiveFlashLoan(
      tokens: PromiseOrValue<void>,
      amounts: PromiseOrValue<BigNumberish>,
      feeAmounts: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    liquidatePosition(
      token: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      params: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    receiveFlashLoan(
      tokens: PromiseOrValue<void>,
      amounts: PromiseOrValue<BigNumberish>,
      feeAmounts: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(_balancerVault: string, signer?: Signer): Promise<MarginlyKeeperBalancerContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(_balancerVault);
  return (await contract.deployed()) as any;
}

export function connect(
  addressOrName: string,
  signerOrProvider?: Signer | providers.Provider
): MarginlyKeeperBalancerContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
