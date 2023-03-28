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
import { abi, bytecode } from '../../artifacts/contracts/usdc.sol/FiatTokenV2_1.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface FiatTokenV2_1Interface extends utils.Interface {
  functions: {
    'allowance(address,address)': utils.FunctionFragment;
    'approve(address,uint256)': utils.FunctionFragment;
    'authorizationState(address,bytes32)': utils.FunctionFragment;
    'balanceOf(address)': utils.FunctionFragment;
    'blacklist(address)': utils.FunctionFragment;
    'blacklister()': utils.FunctionFragment;
    'burn(uint256)': utils.FunctionFragment;
    'CANCEL_AUTHORIZATION_TYPEHASH()': utils.FunctionFragment;
    'cancelAuthorization(address,bytes32,uint8,bytes32,bytes32)': utils.FunctionFragment;
    'configureMinter(address,uint256)': utils.FunctionFragment;
    'currency()': utils.FunctionFragment;
    'decimals()': utils.FunctionFragment;
    'decreaseAllowance(address,uint256)': utils.FunctionFragment;
    'DOMAIN_SEPARATOR()': utils.FunctionFragment;
    'increaseAllowance(address,uint256)': utils.FunctionFragment;
    'initialize(string,string,string,uint8,address,address,address,address)': utils.FunctionFragment;
    'initializeV2(string)': utils.FunctionFragment;
    'initializeV2_1(address)': utils.FunctionFragment;
    'isBlacklisted(address)': utils.FunctionFragment;
    'isMinter(address)': utils.FunctionFragment;
    'masterMinter()': utils.FunctionFragment;
    'mint(address,uint256)': utils.FunctionFragment;
    'minterAllowance(address)': utils.FunctionFragment;
    'name()': utils.FunctionFragment;
    'nonces(address)': utils.FunctionFragment;
    'owner()': utils.FunctionFragment;
    'pause()': utils.FunctionFragment;
    'paused()': utils.FunctionFragment;
    'pauser()': utils.FunctionFragment;
    'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)': utils.FunctionFragment;
    'PERMIT_TYPEHASH()': utils.FunctionFragment;
    'RECEIVE_WITH_AUTHORIZATION_TYPEHASH()': utils.FunctionFragment;
    'receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)': utils.FunctionFragment;
    'removeMinter(address)': utils.FunctionFragment;
    'rescueERC20(address,address,uint256)': utils.FunctionFragment;
    'rescuer()': utils.FunctionFragment;
    'symbol()': utils.FunctionFragment;
    'totalSupply()': utils.FunctionFragment;
    'transfer(address,uint256)': utils.FunctionFragment;
    'TRANSFER_WITH_AUTHORIZATION_TYPEHASH()': utils.FunctionFragment;
    'transferFrom(address,address,uint256)': utils.FunctionFragment;
    'transferOwnership(address)': utils.FunctionFragment;
    'transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)': utils.FunctionFragment;
    'unBlacklist(address)': utils.FunctionFragment;
    'unpause()': utils.FunctionFragment;
    'updateBlacklister(address)': utils.FunctionFragment;
    'updateMasterMinter(address)': utils.FunctionFragment;
    'updatePauser(address)': utils.FunctionFragment;
    'updateRescuer(address)': utils.FunctionFragment;
    'version()': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'allowance'
      | 'approve'
      | 'authorizationState'
      | 'balanceOf'
      | 'blacklist'
      | 'blacklister'
      | 'burn'
      | 'CANCEL_AUTHORIZATION_TYPEHASH'
      | 'cancelAuthorization'
      | 'configureMinter'
      | 'currency'
      | 'decimals'
      | 'decreaseAllowance'
      | 'DOMAIN_SEPARATOR'
      | 'increaseAllowance'
      | 'initialize'
      | 'initializeV2'
      | 'initializeV2_1'
      | 'isBlacklisted'
      | 'isMinter'
      | 'masterMinter'
      | 'mint'
      | 'minterAllowance'
      | 'name'
      | 'nonces'
      | 'owner'
      | 'pause'
      | 'paused'
      | 'pauser'
      | 'permit'
      | 'PERMIT_TYPEHASH'
      | 'RECEIVE_WITH_AUTHORIZATION_TYPEHASH'
      | 'receiveWithAuthorization'
      | 'removeMinter'
      | 'rescueERC20'
      | 'rescuer'
      | 'symbol'
      | 'totalSupply'
      | 'transfer'
      | 'TRANSFER_WITH_AUTHORIZATION_TYPEHASH'
      | 'transferFrom'
      | 'transferOwnership'
      | 'transferWithAuthorization'
      | 'unBlacklist'
      | 'unpause'
      | 'updateBlacklister'
      | 'updateMasterMinter'
      | 'updatePauser'
      | 'updateRescuer'
      | 'version'
  ): utils.FunctionFragment;
}

export interface FiatTokenV2_1Contract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: FiatTokenV2_1Interface;

  allowance(
    owner: PromiseOrValue<string>,
    spender: PromiseOrValue<string>,
    override?: CallOverrides
  ): Promise<BigNumberish>;
  approve(
    spender: PromiseOrValue<string>,
    value: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  authorizationState(
    authorizer: PromiseOrValue<string>,
    nonce: PromiseOrValue<BytesLike>,
    override?: CallOverrides
  ): Promise<boolean>;
  balanceOf(account: PromiseOrValue<string>, override?: CallOverrides): Promise<BigNumberish>;
  blacklist(
    _account: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  blacklister(override?: CallOverrides): Promise<string>;
  burn(
    _amount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  CANCEL_AUTHORIZATION_TYPEHASH(override?: CallOverrides): Promise<BytesLike>;
  cancelAuthorization(
    authorizer: PromiseOrValue<string>,
    nonce: PromiseOrValue<BytesLike>,
    v: PromiseOrValue<BigNumberish>,
    r: PromiseOrValue<BytesLike>,
    s: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  configureMinter(
    minter: PromiseOrValue<string>,
    minterAllowedAmount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  currency(override?: CallOverrides): Promise<string>;
  decimals(override?: CallOverrides): Promise<BigNumberish>;
  decreaseAllowance(
    spender: PromiseOrValue<string>,
    decrement: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  DOMAIN_SEPARATOR(override?: CallOverrides): Promise<BytesLike>;
  increaseAllowance(
    spender: PromiseOrValue<string>,
    increment: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  initialize(
    tokenName: PromiseOrValue<string>,
    tokenSymbol: PromiseOrValue<string>,
    tokenCurrency: PromiseOrValue<string>,
    tokenDecimals: PromiseOrValue<BigNumberish>,
    newMasterMinter: PromiseOrValue<string>,
    newPauser: PromiseOrValue<string>,
    newBlacklister: PromiseOrValue<string>,
    newOwner: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  initializeV2(
    newName: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  initializeV2_1(
    lostAndFound: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  isBlacklisted(_account: PromiseOrValue<string>, override?: CallOverrides): Promise<boolean>;
  isMinter(account: PromiseOrValue<string>, override?: CallOverrides): Promise<boolean>;
  masterMinter(override?: CallOverrides): Promise<string>;
  mint(
    _to: PromiseOrValue<string>,
    _amount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  minterAllowance(minter: PromiseOrValue<string>, override?: CallOverrides): Promise<BigNumberish>;
  name(override?: CallOverrides): Promise<string>;
  nonces(owner: PromiseOrValue<string>, override?: CallOverrides): Promise<BigNumberish>;
  owner(override?: CallOverrides): Promise<string>;
  pause(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  paused(override?: CallOverrides): Promise<boolean>;
  pauser(override?: CallOverrides): Promise<string>;
  permit(
    owner: PromiseOrValue<string>,
    spender: PromiseOrValue<string>,
    value: PromiseOrValue<BigNumberish>,
    deadline: PromiseOrValue<BigNumberish>,
    v: PromiseOrValue<BigNumberish>,
    r: PromiseOrValue<BytesLike>,
    s: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  PERMIT_TYPEHASH(override?: CallOverrides): Promise<BytesLike>;
  RECEIVE_WITH_AUTHORIZATION_TYPEHASH(override?: CallOverrides): Promise<BytesLike>;
  receiveWithAuthorization(
    from: PromiseOrValue<string>,
    to: PromiseOrValue<string>,
    value: PromiseOrValue<BigNumberish>,
    validAfter: PromiseOrValue<BigNumberish>,
    validBefore: PromiseOrValue<BigNumberish>,
    nonce: PromiseOrValue<BytesLike>,
    v: PromiseOrValue<BigNumberish>,
    r: PromiseOrValue<BytesLike>,
    s: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  removeMinter(
    minter: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  rescueERC20(
    tokenContract: PromiseOrValue<string>,
    to: PromiseOrValue<string>,
    amount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  rescuer(override?: CallOverrides): Promise<string>;
  symbol(override?: CallOverrides): Promise<string>;
  totalSupply(override?: CallOverrides): Promise<BigNumberish>;
  transfer(
    to: PromiseOrValue<string>,
    value: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  TRANSFER_WITH_AUTHORIZATION_TYPEHASH(override?: CallOverrides): Promise<BytesLike>;
  transferFrom(
    from: PromiseOrValue<string>,
    to: PromiseOrValue<string>,
    value: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  transferOwnership(
    newOwner: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  transferWithAuthorization(
    from: PromiseOrValue<string>,
    to: PromiseOrValue<string>,
    value: PromiseOrValue<BigNumberish>,
    validAfter: PromiseOrValue<BigNumberish>,
    validBefore: PromiseOrValue<BigNumberish>,
    nonce: PromiseOrValue<BytesLike>,
    v: PromiseOrValue<BigNumberish>,
    r: PromiseOrValue<BytesLike>,
    s: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  unBlacklist(
    _account: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  unpause(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  updateBlacklister(
    _newBlacklister: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  updateMasterMinter(
    _newMasterMinter: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  updatePauser(
    _newPauser: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  updateRescuer(
    newRescuer: PromiseOrValue<string>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  version(override?: CallOverrides): Promise<string>;

  functions: {
    allowance(
      owner: PromiseOrValue<string>,
      spender: PromiseOrValue<string>,
      override?: CallOverrides
    ): Promise<[BigNumberish]>;
    authorizationState(
      authorizer: PromiseOrValue<string>,
      nonce: PromiseOrValue<BytesLike>,
      override?: CallOverrides
    ): Promise<[boolean]>;
    balanceOf(account: PromiseOrValue<string>, override?: CallOverrides): Promise<[BigNumberish]>;
    blacklister(override?: CallOverrides): Promise<[string]>;
    CANCEL_AUTHORIZATION_TYPEHASH(override?: CallOverrides): Promise<[BytesLike]>;
    currency(override?: CallOverrides): Promise<[string]>;
    decimals(override?: CallOverrides): Promise<[BigNumberish]>;
    DOMAIN_SEPARATOR(override?: CallOverrides): Promise<[BytesLike]>;
    isBlacklisted(_account: PromiseOrValue<string>, override?: CallOverrides): Promise<[boolean]>;
    isMinter(account: PromiseOrValue<string>, override?: CallOverrides): Promise<[boolean]>;
    masterMinter(override?: CallOverrides): Promise<[string]>;
    minterAllowance(minter: PromiseOrValue<string>, override?: CallOverrides): Promise<[BigNumberish]>;
    name(override?: CallOverrides): Promise<[string]>;
    nonces(owner: PromiseOrValue<string>, override?: CallOverrides): Promise<[BigNumberish]>;
    owner(override?: CallOverrides): Promise<[string]>;
    paused(override?: CallOverrides): Promise<[boolean]>;
    pauser(override?: CallOverrides): Promise<[string]>;
    PERMIT_TYPEHASH(override?: CallOverrides): Promise<[BytesLike]>;
    RECEIVE_WITH_AUTHORIZATION_TYPEHASH(override?: CallOverrides): Promise<[BytesLike]>;
    rescuer(override?: CallOverrides): Promise<[string]>;
    symbol(override?: CallOverrides): Promise<[string]>;
    totalSupply(override?: CallOverrides): Promise<[BigNumberish]>;
    TRANSFER_WITH_AUTHORIZATION_TYPEHASH(override?: CallOverrides): Promise<[BytesLike]>;
    version(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    approve(
      spender: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    blacklist(
      _account: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    burn(
      _amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    cancelAuthorization(
      authorizer: PromiseOrValue<string>,
      nonce: PromiseOrValue<BytesLike>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    configureMinter(
      minter: PromiseOrValue<string>,
      minterAllowedAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    decreaseAllowance(
      spender: PromiseOrValue<string>,
      decrement: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    increaseAllowance(
      spender: PromiseOrValue<string>,
      increment: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    initialize(
      tokenName: PromiseOrValue<string>,
      tokenSymbol: PromiseOrValue<string>,
      tokenCurrency: PromiseOrValue<string>,
      tokenDecimals: PromiseOrValue<BigNumberish>,
      newMasterMinter: PromiseOrValue<string>,
      newPauser: PromiseOrValue<string>,
      newBlacklister: PromiseOrValue<string>,
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    initializeV2(
      newName: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    initializeV2_1(
      lostAndFound: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    mint(
      _to: PromiseOrValue<string>,
      _amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    pause(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    permit(
      owner: PromiseOrValue<string>,
      spender: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      deadline: PromiseOrValue<BigNumberish>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    receiveWithAuthorization(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      validAfter: PromiseOrValue<BigNumberish>,
      validBefore: PromiseOrValue<BigNumberish>,
      nonce: PromiseOrValue<BytesLike>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    removeMinter(
      minter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    rescueERC20(
      tokenContract: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transfer(
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferWithAuthorization(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      validAfter: PromiseOrValue<BigNumberish>,
      validBefore: PromiseOrValue<BigNumberish>,
      nonce: PromiseOrValue<BytesLike>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    unBlacklist(
      _account: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    unpause(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    updateBlacklister(
      _newBlacklister: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    updateMasterMinter(
      _newMasterMinter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    updatePauser(
      _newPauser: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    updateRescuer(
      newRescuer: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    approve(
      spender: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    blacklist(
      _account: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    burn(
      _amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    cancelAuthorization(
      authorizer: PromiseOrValue<string>,
      nonce: PromiseOrValue<BytesLike>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    configureMinter(
      minter: PromiseOrValue<string>,
      minterAllowedAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    decreaseAllowance(
      spender: PromiseOrValue<string>,
      decrement: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    increaseAllowance(
      spender: PromiseOrValue<string>,
      increment: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    initialize(
      tokenName: PromiseOrValue<string>,
      tokenSymbol: PromiseOrValue<string>,
      tokenCurrency: PromiseOrValue<string>,
      tokenDecimals: PromiseOrValue<BigNumberish>,
      newMasterMinter: PromiseOrValue<string>,
      newPauser: PromiseOrValue<string>,
      newBlacklister: PromiseOrValue<string>,
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    initializeV2(
      newName: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    initializeV2_1(
      lostAndFound: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    mint(
      _to: PromiseOrValue<string>,
      _amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    pause(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    permit(
      owner: PromiseOrValue<string>,
      spender: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      deadline: PromiseOrValue<BigNumberish>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    receiveWithAuthorization(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      validAfter: PromiseOrValue<BigNumberish>,
      validBefore: PromiseOrValue<BigNumberish>,
      nonce: PromiseOrValue<BytesLike>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    removeMinter(
      minter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    rescueERC20(
      tokenContract: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transfer(
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transferWithAuthorization(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      validAfter: PromiseOrValue<BigNumberish>,
      validBefore: PromiseOrValue<BigNumberish>,
      nonce: PromiseOrValue<BytesLike>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    unBlacklist(
      _account: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    unpause(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    updateBlacklister(
      _newBlacklister: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    updateMasterMinter(
      _newMasterMinter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    updatePauser(
      _newPauser: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    updateRescuer(
      newRescuer: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    approve(
      spender: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    blacklist(
      _account: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    burn(
      _amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    cancelAuthorization(
      authorizer: PromiseOrValue<string>,
      nonce: PromiseOrValue<BytesLike>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    configureMinter(
      minter: PromiseOrValue<string>,
      minterAllowedAmount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    decreaseAllowance(
      spender: PromiseOrValue<string>,
      decrement: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    increaseAllowance(
      spender: PromiseOrValue<string>,
      increment: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    initialize(
      tokenName: PromiseOrValue<string>,
      tokenSymbol: PromiseOrValue<string>,
      tokenCurrency: PromiseOrValue<string>,
      tokenDecimals: PromiseOrValue<BigNumberish>,
      newMasterMinter: PromiseOrValue<string>,
      newPauser: PromiseOrValue<string>,
      newBlacklister: PromiseOrValue<string>,
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    initializeV2(
      newName: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    initializeV2_1(
      lostAndFound: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    mint(
      _to: PromiseOrValue<string>,
      _amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    pause(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    permit(
      owner: PromiseOrValue<string>,
      spender: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      deadline: PromiseOrValue<BigNumberish>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    receiveWithAuthorization(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      validAfter: PromiseOrValue<BigNumberish>,
      validBefore: PromiseOrValue<BigNumberish>,
      nonce: PromiseOrValue<BytesLike>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    removeMinter(
      minter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    rescueERC20(
      tokenContract: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    transfer(
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    transferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<boolean>;
    transferOwnership(
      newOwner: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    transferWithAuthorization(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      value: PromiseOrValue<BigNumberish>,
      validAfter: PromiseOrValue<BigNumberish>,
      validBefore: PromiseOrValue<BigNumberish>,
      nonce: PromiseOrValue<BytesLike>,
      v: PromiseOrValue<BigNumberish>,
      r: PromiseOrValue<BytesLike>,
      s: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    unBlacklist(
      _account: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    unpause(override?: Overrides & { from?: PromiseOrValue<string> }): Promise<void>;
    updateBlacklister(
      _newBlacklister: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    updateMasterMinter(
      _newMasterMinter: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    updatePauser(
      _newPauser: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    updateRescuer(
      newRescuer: PromiseOrValue<string>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(signer?: Signer): Promise<FiatTokenV2_1Contract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  return (await contract.deployed()) as any;
}

export function connect(addressOrName: string, signerOrProvider?: Signer | providers.Provider): FiatTokenV2_1Contract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
