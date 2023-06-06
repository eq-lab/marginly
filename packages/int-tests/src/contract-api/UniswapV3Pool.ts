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
  fee(override?: CallOverrides): Promise<BigNumber>;
  feeGrowthGlobal0X128(override?: CallOverrides): Promise<BigNumber>;
  feeGrowthGlobal1X128(override?: CallOverrides): Promise<BigNumber>;
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
  liquidity(override?: CallOverrides): Promise<BigNumber>;
  maxLiquidityPerTick(override?: CallOverrides): Promise<BigNumber>;
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
    blockTimestamp: BigNumber;
    tickCumulative: BigNumber;
    secondsPerLiquidityCumulativeX128: BigNumber;
    initialized: boolean;
  }>;
  observe(
    secondsAgos: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<{ tickCumulatives: BigNumber; secondsPerLiquidityCumulativeX128s: BigNumber }>;
  positions(
    key: PromiseOrValue<BytesLike>,
    override?: CallOverrides
  ): Promise<{
    _liquidity: BigNumber;
    feeGrowthInside0LastX128: BigNumber;
    feeGrowthInside1LastX128: BigNumber;
    tokensOwed0: BigNumber;
    tokensOwed1: BigNumber;
  }>;
  protocolFees(override?: CallOverrides): Promise<{ token0: BigNumber; token1: BigNumber }>;
  setFeeProtocol(
    feeProtocol0: PromiseOrValue<BigNumberish>,
    feeProtocol1: PromiseOrValue<BigNumberish>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  slot0(
    override?: CallOverrides
  ): Promise<{
    sqrtPriceX96: BigNumber;
    tick: BigNumber;
    observationIndex: BigNumber;
    observationCardinality: BigNumber;
    observationCardinalityNext: BigNumber;
    feeProtocol: number;
    unlocked: boolean;
  }>;
  snapshotCumulativesInside(
    tickLower: PromiseOrValue<BigNumberish>,
    tickUpper: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<{ tickCumulativeInside: BigNumber; secondsPerLiquidityInsideX128: BigNumber; secondsInside: BigNumber }>;
  swap(
    recipient: PromiseOrValue<string>,
    zeroForOne: PromiseOrValue<boolean>,
    amountSpecified: PromiseOrValue<BigNumberish>,
    sqrtPriceLimitX96: PromiseOrValue<BigNumberish>,
    data: PromiseOrValue<BytesLike>,
    override?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;
  tickBitmap(wordPosition: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<BigNumber>;
  ticks(
    tick: PromiseOrValue<BigNumberish>,
    override?: CallOverrides
  ): Promise<{
    liquidityGross: BigNumber;
    liquidityNet: BigNumber;
    feeGrowthOutside0X128: BigNumber;
    feeGrowthOutside1X128: BigNumber;
    tickCumulativeOutside: BigNumber;
    secondsPerLiquidityOutsideX128: BigNumber;
    secondsOutside: BigNumber;
    initialized: boolean;
  }>;
  tickSpacing(override?: CallOverrides): Promise<BigNumber>;
  token0(override?: CallOverrides): Promise<string>;
  token1(override?: CallOverrides): Promise<string>;

  functions: {
    factory(override?: CallOverrides): Promise<[string]>;
    fee(override?: CallOverrides): Promise<[BigNumber]>;
    feeGrowthGlobal0X128(override?: CallOverrides): Promise<[BigNumber]>;
    feeGrowthGlobal1X128(override?: CallOverrides): Promise<[BigNumber]>;
    liquidity(override?: CallOverrides): Promise<[BigNumber]>;
    maxLiquidityPerTick(override?: CallOverrides): Promise<[BigNumber]>;
    observations(
      index: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<{
      blockTimestamp: BigNumber;
      tickCumulative: BigNumber;
      secondsPerLiquidityCumulativeX128: BigNumber;
      initialized: boolean;
    }>;
    observe(
      secondsAgos: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<{ tickCumulatives: BigNumber; secondsPerLiquidityCumulativeX128s: BigNumber }>;
    positions(
      key: PromiseOrValue<BytesLike>,
      override?: CallOverrides
    ): Promise<{
      _liquidity: BigNumber;
      feeGrowthInside0LastX128: BigNumber;
      feeGrowthInside1LastX128: BigNumber;
      tokensOwed0: BigNumber;
      tokensOwed1: BigNumber;
    }>;
    protocolFees(override?: CallOverrides): Promise<{ token0: BigNumber; token1: BigNumber }>;
    slot0(
      override?: CallOverrides
    ): Promise<{
      sqrtPriceX96: BigNumber;
      tick: BigNumber;
      observationIndex: BigNumber;
      observationCardinality: BigNumber;
      observationCardinalityNext: BigNumber;
      feeProtocol: number;
      unlocked: boolean;
    }>;
    snapshotCumulativesInside(
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<{ tickCumulativeInside: BigNumber; secondsPerLiquidityInsideX128: BigNumber; secondsInside: BigNumber }>;
    tickBitmap(wordPosition: PromiseOrValue<BigNumberish>, override?: CallOverrides): Promise<[BigNumber]>;
    ticks(
      tick: PromiseOrValue<BigNumberish>,
      override?: CallOverrides
    ): Promise<{
      liquidityGross: BigNumber;
      liquidityNet: BigNumber;
      feeGrowthOutside0X128: BigNumber;
      feeGrowthOutside1X128: BigNumber;
      tickCumulativeOutside: BigNumber;
      secondsPerLiquidityOutsideX128: BigNumber;
      secondsOutside: BigNumber;
      initialized: boolean;
    }>;
    tickSpacing(override?: CallOverrides): Promise<[BigNumber]>;
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
    ): Promise<{ amount0: BigNumber; amount1: BigNumber }>;
    collect(
      recipient: PromiseOrValue<string>,
      tickLower: PromiseOrValue<BigNumberish>,
      tickUpper: PromiseOrValue<BigNumberish>,
      amount0Requested: PromiseOrValue<BigNumberish>,
      amount1Requested: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<{ amount0: BigNumber; amount1: BigNumber }>;
    collectProtocol(
      recipient: PromiseOrValue<string>,
      amount0Requested: PromiseOrValue<BigNumberish>,
      amount1Requested: PromiseOrValue<BigNumberish>,
      override?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<{ amount0: BigNumber; amount1: BigNumber }>;
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
    ): Promise<{ amount0: BigNumber; amount1: BigNumber }>;
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
    ): Promise<{ amount0: BigNumber; amount1: BigNumber }>;
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
