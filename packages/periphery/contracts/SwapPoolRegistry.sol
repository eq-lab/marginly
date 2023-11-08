// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';

///@dev The contract acts like UniswapV3Factory but has self storage of swap pools that overrides uniswapV3Factorys pool mapping
contract SwapPoolRegistry is IUniswapV3Factory {
  error Forbidden();
  error WrongParameters();

  /// @notice Emitted when a swap pool is added into registry
  /// @param token0 The first token of the pool by address sort order
  /// @param token1 The second token of the pool by address sort order
  /// @param fee The fee collected upon every swap in the pool, denominated in hundredths of a bip
  /// @param pool The address of the created pool
  event SwapPoolAdded(address indexed token0, address indexed token1, uint24 fee, address indexed pool);

  ///@dev Address of a canonical UniswapV3Factory
  address public immutable uniswapFactory;

  /// @inheritdoc IUniswapV3Factory
  address public override owner;

  struct SwapPool {
    address pool;
    address tokenA;
    address tokenB;
    uint24 fee;
  }

  ///@dev Custom non-uniswap swap pools
  mapping(address => mapping(address => mapping(uint24 => address))) public swapPools;

  constructor(address _uniswapV3Factory, SwapPool[] memory pools) {
    if (_uniswapV3Factory == address(0)) revert WrongParameters();

    owner = msg.sender;
    uniswapFactory = _uniswapV3Factory;

    uint256 length = pools.length;
    for (uint256 i; i < length; ) {
      _addSwapPool(pools[i]);
      unchecked {
        ++i;
      }
    }
  }

  /// @inheritdoc IUniswapV3Factory
  function getPool(address tokenA, address tokenB, uint24 fee) external view override returns (address pool) {
    pool = swapPools[tokenA][tokenB][fee];
    if (pool != address(0)) return pool;

    pool = IUniswapV3Factory(uniswapFactory).getPool(tokenA, tokenB, fee);
  }

  /// @inheritdoc IUniswapV3Factory
  function createPool(address, address, uint24) external pure override returns (address) {
    revert Forbidden();
  }

  /// @inheritdoc IUniswapV3Factory
  function setOwner(address _owner) external override {
    if (msg.sender != owner) revert Forbidden();
    owner = _owner;
    emit OwnerChanged(msg.sender, _owner);
  }

  /// @inheritdoc IUniswapV3Factory
  function enableFeeAmount(uint24, int24) external pure override {
    revert Forbidden();
  }

  /// @inheritdoc IUniswapV3Factory
  function feeAmountTickSpacing(uint24 fee) external view returns (int24) {
    return IUniswapV3Factory(uniswapFactory).feeAmountTickSpacing(fee);
  }

  ///@dev Adds swap pool
  function addSwapPool(SwapPool[] calldata _pools) external {
    if (msg.sender != owner) revert Forbidden();

    uint256 length = _pools.length;
    for (uint256 i; i < length; ) {
      _addSwapPool(_pools[i]);
      unchecked {
        ++i;
      }
    }
  }

  function _addSwapPool(SwapPool memory pool) private {
    if (pool.tokenA == pool.tokenB) revert WrongParameters();
    if (pool.tokenA == address(0)) revert WrongParameters();
    if (pool.tokenB == address(0)) revert WrongParameters();

    (address token0, address token1) = pool.tokenA < pool.tokenB
      ? (pool.tokenA, pool.tokenB)
      : (pool.tokenB, pool.tokenA);

    swapPools[token0][token1][pool.fee] = pool.pool;
    swapPools[token1][token0][pool.fee] = pool.pool;

    emit SwapPoolAdded(token0, token1, pool.fee, pool.pool);
  }
}
