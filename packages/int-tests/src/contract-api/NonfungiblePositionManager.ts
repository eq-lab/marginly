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
import {
  abi,
  bytecode,
} from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface NonfungiblePositionManagerInterface extends utils.Interface {
  functions: {
    'approve(address,uint256)': utils.FunctionFragment;
    'balanceOf(address)': utils.FunctionFragment;
    'burn(uint256)': utils.FunctionFragment;
    'collect(tuple)': utils.FunctionFragment;
    'createAndInitializePoolIfNecessary(address,address,uint24,uint160)': utils.FunctionFragment;
    'decreaseLiquidity(tuple)': utils.FunctionFragment;
    'DOMAIN_SEPARATOR()': utils.FunctionFragment;
    'factory()': utils.FunctionFragment;
    'getApproved(uint256)': utils.FunctionFragment;
    'increaseLiquidity(tuple)': utils.FunctionFragment;
    'isApprovedForAll(address,address)': utils.FunctionFragment;
    'mint(tuple)': utils.FunctionFragment;
    'name()': utils.FunctionFragment;
    'ownerOf(uint256)': utils.FunctionFragment;
    'permit(address,uint256,uint256,uint8,bytes32,bytes32)': utils.FunctionFragment;
    'PERMIT_TYPEHASH()': utils.FunctionFragment;
    'positions(uint256)': utils.FunctionFragment;
    'refundETH()': utils.FunctionFragment;
    'safeTransferFrom(address,address,uint256,bytes)': utils.FunctionFragment;
    'setApprovalForAll(address,bool)': utils.FunctionFragment;
    'supportsInterface(bytes4)': utils.FunctionFragment;
    'sweepToken(address,uint256,address)': utils.FunctionFragment;
    'symbol()': utils.FunctionFragment;
    'tokenByIndex(uint256)': utils.FunctionFragment;
    'tokenOfOwnerByIndex(address,uint256)': utils.FunctionFragment;
    'tokenURI(uint256)': utils.FunctionFragment;
    'totalSupply()': utils.FunctionFragment;
    'transferFrom(address,address,uint256)': utils.FunctionFragment;
    'unwrapWETH9(uint256,address)': utils.FunctionFragment;
    'WETH9()': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'approve'
      | 'balanceOf'
      | 'burn'
      | 'collect'
      | 'createAndInitializePoolIfNecessary'
      | 'decreaseLiquidity'
      | 'DOMAIN_SEPARATOR'
      | 'factory'
      | 'getApproved'
      | 'increaseLiquidity'
      | 'isApprovedForAll'
      | 'mint'
      | 'name'
      | 'ownerOf'
      | 'permit'
      | 'PERMIT_TYPEHASH'
      | 'positions'
      | 'refundETH'
      | 'safeTransferFrom'
      | 'setApprovalForAll'
      | 'supportsInterface'
      | 'sweepToken'
      | 'symbol'
      | 'tokenByIndex'
      | 'tokenOfOwnerByIndex'
      | 'tokenURI'
      | 'totalSupply'
      | 'transferFrom'
      | 'unwrapWETH9'
      | 'WETH9'
  ): utils.FunctionFragment;
}

export interface NonfungiblePositionManagerContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: NonfungiblePositionManagerInterface;

  approve(
    to: PromiseOrValue<string>,
    tokenId: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  balanceOf(owner: PromiseOrValue<string>, override?: CallOverrides): Promise<BigNumber>;
  burn(
    tokenId: BigNumberish,
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  collect(
    params: { tokenId: BigNumberish; recipient: string; amount0Max: BigNumberish; amount1Max: BigNumberish },
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  createAndInitializePoolIfNecessary(
    token0: string,
    token1: string,
    fee: BigNumberish,
    sqrtPriceX96: BigNumberish,
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  decreaseLiquidity(
    params: {
      tokenId: BigNumberish;
      liquidity: BigNumberish;
      amount0Min: BigNumberish;
      amount1Min: BigNumberish;
      deadline: BigNumberish;
    },
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  DOMAIN_SEPARATOR(override?: CallOverrides): Promise<BytesLike>;
  factory(override?: CallOverrides): Promise<string>;
  getApproved(tokenId: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<string>;
  increaseLiquidity(
    params: {
      tokenId: BigNumberish;
      amount0Desired: BigNumberish;
      amount1Desired: BigNumberish;
      amount0Min: BigNumberish;
      amount1Min: BigNumberish;
      deadline: BigNumberish;
    },
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  isApprovedForAll(
    owner: PromiseOrValue<string>,
    operator: PromiseOrValue<string>,
    override?: CallOverrides
  ): Promise<boolean>;
  mint(
    params: {
      token0: string;
      token1: string;
      fee: BigNumberish;
      tickLower: BigNumberish;
      tickUpper: BigNumberish;
      amount0Desired: BigNumberish;
      amount1Desired: BigNumberish;
      amount0Min: BigNumberish;
      amount1Min: BigNumberish;
      recipient: string;
      deadline: BigNumberish;
    },
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  name(override?: CallOverrides): Promise<string>;
  ownerOf(tokenId: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<string>;
  permit(
    spender: string,
    tokenId: BigNumberish,
    deadline: BigNumberish,
    v: BigNumberish,
    r: BytesLike,
    s: BytesLike,
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  PERMIT_TYPEHASH(override?: CallOverrides): Promise<BytesLike>;
  positions(
    tokenId: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<{
    nonce: BigNumber;
    operator: string;
    token0: string;
    token1: string;
    fee: BigNumber;
    tickLower: BigNumber;
    tickUpper: BigNumber;
    liquidity: BigNumber;
    feeGrowthInside0LastX128: BigNumber;
    feeGrowthInside1LastX128: BigNumber;
    tokensOwed0: BigNumber;
    tokensOwed1: BigNumber;
  }>;
  refundETH(override?: PayableOverrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>;
  safeTransferFrom(
    from: PromiseOrValue<string>,
    to: PromiseOrValue<string>,
    tokenId: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  setApprovalForAll(
    operator: PromiseOrValue<string>,
    _approved: PromiseOrValue<boolean>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  supportsInterface(interfaceId: PromiseOrValue<BytesLike>, override?: CallOverrides): Promise<boolean>;
  sweepToken(
    token: string,
    amountMinimum: BigNumberish,
    recipient: string,
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  symbol(override?: CallOverrides): Promise<string>;
  tokenByIndex(index: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<BigNumber>;
  tokenOfOwnerByIndex(
    owner: PromiseOrValue<string>,
    index: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<BigNumber>;
  tokenURI(tokenId: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<string>;
  totalSupply(override?: CallOverrides): Promise<BigNumber>;
  transferFrom(
    from: PromiseOrValue<string>,
    to: PromiseOrValue<string>,
    tokenId: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  unwrapWETH9(
    amountMinimum: BigNumberish,
    recipient: string,
    override?: PayableOverrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  WETH9(override?: CallOverrides): Promise<string>;

  functions: {
    balanceOf(owner: PromiseOrValue<string>, override?: CallOverrides): Promise<{ balance: BigNumber }>;
    DOMAIN_SEPARATOR(override?: CallOverrides): Promise<[BytesLike]>;
    factory(override?: CallOverrides): Promise<[string]>;
    getApproved(tokenId: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<{ operator: string }>;
    isApprovedForAll(
      owner: PromiseOrValue<string>,
      operator: PromiseOrValue<string>,
      override?: CallOverrides
    ): Promise<[boolean]>;
    name(override?: CallOverrides): Promise<[string]>;
    ownerOf(tokenId: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<{ owner: string }>;
    PERMIT_TYPEHASH(override?: CallOverrides): Promise<[BytesLike]>;
    positions(
      tokenId: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<{
      nonce: BigNumber;
      operator: string;
      token0: string;
      token1: string;
      fee: BigNumber;
      tickLower: BigNumber;
      tickUpper: BigNumber;
      liquidity: BigNumber;
      feeGrowthInside0LastX128: BigNumber;
      feeGrowthInside1LastX128: BigNumber;
      tokensOwed0: BigNumber;
      tokensOwed1: BigNumber;
    }>;
    supportsInterface(interfaceId: PromiseOrValue<BytesLike>, override?: CallOverrides): Promise<[boolean]>;
    symbol(override?: CallOverrides): Promise<[string]>;
    tokenByIndex(index: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<[BigNumber]>;
    tokenOfOwnerByIndex(
      owner: PromiseOrValue<string>,
      index: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<{ tokenId: BigNumber }>;
    tokenURI(tokenId: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<[string]>;
    totalSupply(override?: CallOverrides): Promise<[BigNumber]>;
    WETH9(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    approve(
      to: PromiseOrValue<string>,
      tokenId: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    burn(tokenId: BigNumberish, override?: PayableOverrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    collect(
      params: { tokenId: BigNumberish; recipient: string; amount0Max: BigNumberish; amount1Max: BigNumberish },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    createAndInitializePoolIfNecessary(
      token0: string,
      token1: string,
      fee: BigNumberish,
      sqrtPriceX96: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    decreaseLiquidity(
      params: {
        tokenId: BigNumberish;
        liquidity: BigNumberish;
        amount0Min: BigNumberish;
        amount1Min: BigNumberish;
        deadline: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    increaseLiquidity(
      params: {
        tokenId: BigNumberish;
        amount0Desired: BigNumberish;
        amount1Desired: BigNumberish;
        amount0Min: BigNumberish;
        amount1Min: BigNumberish;
        deadline: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    mint(
      params: {
        token0: string;
        token1: string;
        fee: BigNumberish;
        tickLower: BigNumberish;
        tickUpper: BigNumberish;
        amount0Desired: BigNumberish;
        amount1Desired: BigNumberish;
        amount0Min: BigNumberish;
        amount1Min: BigNumberish;
        recipient: string;
        deadline: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    permit(
      spender: string,
      tokenId: BigNumberish,
      deadline: BigNumberish,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    refundETH(override?: PayableOverrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>;
    safeTransferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      tokenId: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    setApprovalForAll(
      operator: PromiseOrValue<string>,
      _approved: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    sweepToken(
      token: string,
      amountMinimum: BigNumberish,
      recipient: string,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    transferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      tokenId: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    unwrapWETH9(
      amountMinimum: BigNumberish,
      recipient: string,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    approve(
      to: PromiseOrValue<string>,
      tokenId: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    burn(
      tokenId: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    collect(
      params: { tokenId: BigNumberish; recipient: string; amount0Max: BigNumberish; amount1Max: BigNumberish },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    createAndInitializePoolIfNecessary(
      token0: string,
      token1: string,
      fee: BigNumberish,
      sqrtPriceX96: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    decreaseLiquidity(
      params: {
        tokenId: BigNumberish;
        liquidity: BigNumberish;
        amount0Min: BigNumberish;
        amount1Min: BigNumberish;
        deadline: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    increaseLiquidity(
      params: {
        tokenId: BigNumberish;
        amount0Desired: BigNumberish;
        amount1Desired: BigNumberish;
        amount0Min: BigNumberish;
        amount1Min: BigNumberish;
        deadline: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    mint(
      params: {
        token0: string;
        token1: string;
        fee: BigNumberish;
        tickLower: BigNumberish;
        tickUpper: BigNumberish;
        amount0Desired: BigNumberish;
        amount1Desired: BigNumberish;
        amount0Min: BigNumberish;
        amount1Min: BigNumberish;
        recipient: string;
        deadline: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    permit(
      spender: string,
      tokenId: BigNumberish,
      deadline: BigNumberish,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    refundETH(override?: PayableOverrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>;
    safeTransferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      tokenId: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    setApprovalForAll(
      operator: PromiseOrValue<string>,
      _approved: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    sweepToken(
      token: string,
      amountMinimum: BigNumberish,
      recipient: string,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    transferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      tokenId: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    unwrapWETH9(
      amountMinimum: BigNumberish,
      recipient: string,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    approve(
      to: PromiseOrValue<string>,
      tokenId: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    burn(tokenId: BigNumberish, override?: PayableOverrides & { from?: PromiseOrValue<string> }): Promise<void>;
    collect(
      params: { tokenId: BigNumberish; recipient: string; amount0Max: BigNumberish; amount1Max: BigNumberish },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<{ amount0: BigNumber; amount1: BigNumber }>;
    createAndInitializePoolIfNecessary(
      token0: string,
      token1: string,
      fee: BigNumberish,
      sqrtPriceX96: BigNumberish,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<string>;
    decreaseLiquidity(
      params: {
        tokenId: BigNumberish;
        liquidity: BigNumberish;
        amount0Min: BigNumberish;
        amount1Min: BigNumberish;
        deadline: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<{ amount0: BigNumber; amount1: BigNumber }>;
    increaseLiquidity(
      params: {
        tokenId: BigNumberish;
        amount0Desired: BigNumberish;
        amount1Desired: BigNumberish;
        amount0Min: BigNumberish;
        amount1Min: BigNumberish;
        deadline: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<{ liquidity: BigNumber; amount0: BigNumber; amount1: BigNumber }>;
    mint(
      params: {
        token0: string;
        token1: string;
        fee: BigNumberish;
        tickLower: BigNumberish;
        tickUpper: BigNumberish;
        amount0Desired: BigNumberish;
        amount1Desired: BigNumberish;
        amount0Min: BigNumberish;
        amount1Min: BigNumberish;
        recipient: string;
        deadline: BigNumberish;
      },
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<{ tokenId: BigNumber; liquidity: BigNumber; amount0: BigNumber; amount1: BigNumber }>;
    permit(
      spender: string,
      tokenId: BigNumberish,
      deadline: BigNumberish,
      v: BigNumberish,
      r: BytesLike,
      s: BytesLike,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    refundETH(override?: PayableOverrides & { from?: PromiseOrValue<string> }): Promise<void>;
    safeTransferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      tokenId: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    setApprovalForAll(
      operator: PromiseOrValue<string>,
      _approved: PromiseOrValue<boolean>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    sweepToken(
      token: string,
      amountMinimum: BigNumberish,
      recipient: string,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    transferFrom(
      from: PromiseOrValue<string>,
      to: PromiseOrValue<string>,
      tokenId: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    unwrapWETH9(
      amountMinimum: BigNumberish,
      recipient: string,
      override?: PayableOverrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
  };
}

export async function deploy(signer?: Signer): Promise<NonfungiblePositionManagerContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  return (await contract.deployed()) as any;
}

export function connect(
  addressOrName: string,
  signerOrProvider?: Signer | providers.Provider
): NonfungiblePositionManagerContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
