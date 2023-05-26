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
import { abi, bytecode } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json';
import { PromiseOrValue } from '../utils/api-gen';

export interface UniswapV3PoolInterface extends utils.Interface {
  functions: {
    'burn(int24,int24,uint128)': utils.FunctionFragment;
    'collect(address,int24,int24,uint128,uint128)': utils.FunctionFragment;
    'collectProtocol(address,uint128,uint128)': utils.FunctionFragment;
    'factory()': utils.FunctionFragment;
    'fee()': utils.FunctionFragment;
    'feeGrowthGlobal0X128()': utils.FunctionFragment;
    'feeGrowthGlobal1X128()': utils.FunctionFragment;
    'flash(address,uint256,uint256,bytes)': utils.FunctionFragment;
    'increaseObservationCardinalityNext(uint16)': utils.FunctionFragment;
    'initialize(uint160)': utils.FunctionFragment;
    'liquidity()': utils.FunctionFragment;
    'maxLiquidityPerTick()': utils.FunctionFragment;
    'mint(address,int24,int24,uint128,bytes)': utils.FunctionFragment;
    'observations(uint256)': utils.FunctionFragment;
    'observe(uint32[])': utils.FunctionFragment;
    'positions(bytes32)': utils.FunctionFragment;
    'protocolFees()': utils.FunctionFragment;
    'setFeeProtocol(uint8,uint8)': utils.FunctionFragment;
    'slot0()': utils.FunctionFragment;
    'snapshotCumulativesInside(int24,int24)': utils.FunctionFragment;
    'swap(address,bool,int256,uint160,bytes)': utils.FunctionFragment;
    'tickBitmap(int16)': utils.FunctionFragment;
    'ticks(int24)': utils.FunctionFragment;
    'tickSpacing()': utils.FunctionFragment;
    'token0()': utils.FunctionFragment;
    'token1()': utils.FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | 'burn'
      | 'collect'
      | 'collectProtocol'
      | 'factory'
      | 'fee'
      | 'feeGrowthGlobal0X128'
      | 'feeGrowthGlobal1X128'
      | 'flash'
      | 'increaseObservationCardinalityNext'
      | 'initialize'
      | 'liquidity'
      | 'maxLiquidityPerTick'
      | 'mint'
      | 'observations'
      | 'observe'
      | 'positions'
      | 'protocolFees'
      | 'setFeeProtocol'
      | 'slot0'
      | 'snapshotCumulativesInside'
      | 'swap'
      | 'tickBitmap'
      | 'ticks'
      | 'tickSpacing'
      | 'token0'
      | 'token1'
  ): utils.FunctionFragment;
}

export interface UniswapV3PoolContract extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: UniswapV3PoolInterface;

  burn(
    tickLower: PromiseOrValue<BigNumberish>,
    tickUpper: PromiseOrValue<BigNumberish>,
    amount: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  collect(
    recipient: PromiseOrValue<string>,
    tickLower: PromiseOrValue<BigNumberish>,
    tickUpper: PromiseOrValue<BigNumberish>,
    amount0Requested: PromiseOrValue<BigNumberish>,
    amount1Requested: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  collectProtocol(
    recipient: PromiseOrValue<string>,
    amount0Requested: PromiseOrValue<BigNumberish>,
    amount1Requested: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  factory(override?: CallOverrides): Promise<string>;
  fee(override?: CallOverrides): Promise<BigNumberish>;
  feeGrowthGlobal0X128(override?: CallOverrides): Promise<BigNumberish>;
  feeGrowthGlobal1X128(override?: CallOverrides): Promise<BigNumberish>;
  flash(
    recipient: PromiseOrValue<string>,
    amount0: PromiseOrValue<BigNumberish>,
    amount1: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  increaseObservationCardinalityNext(
    observationCardinalityNext: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  initialize(
    sqrtPriceX96: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  liquidity(override?: CallOverrides): Promise<BigNumberish>;
  maxLiquidityPerTick(override?: CallOverrides): Promise<BigNumberish>;
  mint(
    recipient: PromiseOrValue<string>,
    tickLower: PromiseOrValue<BigNumberish>,
    tickUpper: PromiseOrValue<BigNumberish>,
    amount: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  observations(
    index: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<{
    blockTimestamp: BigNumberish;
    tickCumulative: BigNumberish;
    secondsPerLiquidityCumulativeX128: BigNumberish;
    initialized: boolean;
  }>;
  observe(
    secondsAgos: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<{ tickCumulatives: BigNumberish; secondsPerLiquidityCumulativeX128s: BigNumberish }>;
  positions(
    key: PromiseOrValue<BytesLike>,
    override?: CallOverrides
  ): Promise<{
    _liquidity: BigNumberish;
    feeGrowthInside0LastX128: BigNumberish;
    feeGrowthInside1LastX128: BigNumberish;
    tokensOwed0: BigNumberish;
    tokensOwed1: BigNumberish;
  }>;
  protocolFees(override?: CallOverrides): Promise<{ token0: BigNumberish; token1: BigNumberish }>;
  setFeeProtocol(
    feeProtocol0: PromiseOrValue<BigNumberish>,
    feeProtocol1: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  slot0(override?: CallOverrides): Promise<{
    sqrtPriceX96: BigNumberish;
    tick: BigNumberish;
    observationIndex: BigNumberish;
    observationCardinality: BigNumberish;
    observationCardinalityNext: BigNumberish;
    feeProtocol: BigNumberish;
    unlocked: boolean;
  }>;
  snapshotCumulativesInside(
    tickLower: PromiseOrValue<BigNumberish>,
    tickUpper: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<{
    tickCumulativeInside: BigNumberish;
    secondsPerLiquidityInsideX128: BigNumberish;
    secondsInside: BigNumberish;
  }>;
  swap(
    recipient: PromiseOrValue<string>,
    zeroForOne: PromiseOrValue<boolean>,
    amountSpecified: PromiseOrValue<BigNumberish>,
    sqrtPriceLimitX96: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  tickBitmap(wordPosition: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<BigNumberish>;
  ticks(
    tick: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<{
    liquidityGross: BigNumberish;
    liquidityNet: BigNumberish;
    feeGrowthOutside0X128: BigNumberish;
    feeGrowthOutside1X128: BigNumberish;
    tickCumulativeOutside: BigNumberish;
    secondsPerLiquidityOutsideX128: BigNumberish;
    secondsOutside: BigNumberish;
    initialized: boolean;
  }>;
  tickSpacing(override?: CallOverrides): Promise<BigNumberish>;
  token0(override?: CallOverrides): Promise<string>;
  token1(override?: CallOverrides): Promise<string>;

  functions: {
    factory(override?: CallOverrides): Promise<[string]>;
    fee(override?: CallOverrides): Promise<[BigNumberish]>;
    feeGrowthGlobal0X128(override?: CallOverrides): Promise<[BigNumberish]>;
    feeGrowthGlobal1X128(override?: CallOverrides): Promise<[BigNumberish]>;
    liquidity(override?: CallOverrides): Promise<[BigNumberish]>;
    maxLiquidityPerTick(override?: CallOverrides): Promise<[BigNumberish]>;
    observations(
      index: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<{
      blockTimestamp: BigNumberish;
      tickCumulative: BigNumberish;
      secondsPerLiquidityCumulativeX128: BigNumberish;
      initialized: boolean;
    }>;
    observe(
      secondsAgos: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<{ tickCumulatives: BigNumberish; secondsPerLiquidityCumulativeX128s: BigNumberish }>;
    positions(
      key: PromiseOrValue<BytesLike>,
      override?: CallOverrides
    ): Promise<{
      _liquidity: BigNumberish;
      feeGrowthInside0LastX128: BigNumberish;
      feeGrowthInside1LastX128: BigNumberish;
      tokensOwed0: BigNumberish;
      tokensOwed1: BigNumberish;
    }>;
    protocolFees(override?: CallOverrides): Promise<{ token0: BigNumberish; token1: BigNumberish }>;
    slot0(override?: CallOverrides): Promise<{
      sqrtPriceX96: BigNumberish;
      tick: BigNumberish;
      observationIndex: BigNumberish;
      observationCardinality: BigNumberish;
      observationCardinalityNext: BigNumberish;
      feeProtocol: BigNumberish;
      unlocked: boolean;
    }>;
    snapshotCumulativesInside(
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<{
      tickCumulativeInside: BigNumberish;
      secondsPerLiquidityInsideX128: BigNumberish;
      secondsInside: BigNumberish;
    }>;
    tickBitmap(wordPosition: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<[BigNumberish]>;
    ticks(
      tick: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<{
      liquidityGross: BigNumberish;
      liquidityNet: BigNumberish;
      feeGrowthOutside0X128: BigNumberish;
      feeGrowthOutside1X128: BigNumberish;
      tickCumulativeOutside: BigNumberish;
      secondsPerLiquidityOutsideX128: BigNumberish;
      secondsOutside: BigNumberish;
      initialized: boolean;
    }>;
    tickSpacing(override?: CallOverrides): Promise<[BigNumberish]>;
    token0(override?: CallOverrides): Promise<[string]>;
    token1(override?: CallOverrides): Promise<[string]>;
  };
  estimateGas: {
    burn(
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    collect(
      recipient: PromiseOrValue<string>,
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      amount0Requested: PromiseOrValue<BigNumberish>,
      amount1Requested: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    collectProtocol(
      recipient: PromiseOrValue<string>,
      amount0Requested: PromiseOrValue<BigNumberish>,
      amount1Requested: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    flash(
      recipient: PromiseOrValue<string>,
      amount0: PromiseOrValue<BigNumberish>,
      amount1: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    increaseObservationCardinalityNext(
      observationCardinalityNext: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    initialize(
      sqrtPriceX96: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    mint(
      recipient: PromiseOrValue<string>,
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      amount: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    setFeeProtocol(
      feeProtocol0: PromiseOrValue<BigNumberish>,
      feeProtocol1: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
    swap(
      recipient: PromiseOrValue<string>,
      zeroForOne: PromiseOrValue<boolean>,
      amountSpecified: PromiseOrValue<BigNumberish>,
      sqrtPriceLimitX96: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;
  };
  populateTransaction: {
    burn(
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    collect(
      recipient: PromiseOrValue<string>,
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      amount0Requested: PromiseOrValue<BigNumberish>,
      amount1Requested: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    collectProtocol(
      recipient: PromiseOrValue<string>,
      amount0Requested: PromiseOrValue<BigNumberish>,
      amount1Requested: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    flash(
      recipient: PromiseOrValue<string>,
      amount0: PromiseOrValue<BigNumberish>,
      amount1: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    increaseObservationCardinalityNext(
      observationCardinalityNext: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    initialize(
      sqrtPriceX96: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    mint(
      recipient: PromiseOrValue<string>,
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      amount: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    setFeeProtocol(
      feeProtocol0: PromiseOrValue<BigNumberish>,
      feeProtocol1: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
    swap(
      recipient: PromiseOrValue<string>,
      zeroForOne: PromiseOrValue<boolean>,
      amountSpecified: PromiseOrValue<BigNumberish>,
      sqrtPriceLimitX96: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;
  };
  callStatic: {
    burn(
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      amount: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<{ amount0: BigNumberish; amount1: BigNumberish }>;
    collect(
      recipient: PromiseOrValue<string>,
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      amount0Requested: PromiseOrValue<BigNumberish>,
      amount1Requested: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<{ amount0: BigNumberish; amount1: BigNumberish }>;
    collectProtocol(
      recipient: PromiseOrValue<string>,
      amount0Requested: PromiseOrValue<BigNumberish>,
      amount1Requested: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<{ amount0: BigNumberish; amount1: BigNumberish }>;
    flash(
      recipient: PromiseOrValue<string>,
      amount0: PromiseOrValue<BigNumberish>,
      amount1: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    increaseObservationCardinalityNext(
      observationCardinalityNext: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    initialize(
      sqrtPriceX96: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    mint(
      recipient: PromiseOrValue<string>,
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      amount: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<{ amount0: BigNumberish; amount1: BigNumberish }>;
    setFeeProtocol(
      feeProtocol0: PromiseOrValue<BigNumberish>,
      feeProtocol1: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<void>;
    swap(
      recipient: PromiseOrValue<string>,
      zeroForOne: PromiseOrValue<boolean>,
      amountSpecified: PromiseOrValue<BigNumberish>,
      sqrtPriceLimitX96: PromiseOrValue<BigNumberish>,
      data: PromiseOrValue<BytesLike>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<{ amount0: BigNumberish; amount1: BigNumberish }>;
  };
}

export async function deploy(signer?: Signer): Promise<UniswapV3PoolContract> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  return (await contract.deployed()) as any;
}

export function connect(addressOrName: string, signerOrProvider?: Signer | providers.Provider): UniswapV3PoolContract {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect,
  deploy,
};
