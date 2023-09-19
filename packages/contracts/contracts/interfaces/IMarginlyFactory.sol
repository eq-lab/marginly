// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import './IOwnable.sol';
import '../dataTypes/MarginlyParams.sol';

interface IMarginlyFactory is IOwnable {
  /// @notice Emitted when a pool is created
  /// @param quoteToken The stable-coin
  /// @param baseToken The base token
  /// @param uniswapPool The address of associated Uniswap pool
  /// @param quoteTokenIsToken0 What token in Uniswap pool is stable-coin
  /// @param pool The address of the created pool
  event PoolCreated(
    address indexed quoteToken,
    address indexed baseToken,
    address uniswapPool,
    bool quoteTokenIsToken0,
    address pool
  );

  /// @notice Emitted when changeSwapRouter was executed
  /// @param newSwapRouter new swap router address
  event NewSwapRouter(address indexed newSwapRouter);

  /// @notice Creates a pool for the two given tokens and fee
  /// @param quoteToken One of the two tokens in the desired pool
  /// @param baseToken The other of the two tokens in the desired pool
  /// @param uniswapFee Fee for uniswap pool
  /// @param params pool parameters
  /// @dev tokenA and tokenB may be passed in either order: token0/token1 or token1/token0. tickSpacing is retrieved
  /// from the fee. The call will revert if the pool already exists, the fee is invalid, or the token arguments
  /// are invalid.
  /// @return pool The address of the newly created pool
  function createPool(
    address quoteToken,
    address baseToken,
    uint24 uniswapFee,
    MarginlyParams memory params
  ) external returns (address pool);

  /// @notice Changes swap router address used by Marginly pools
  /// @param newSwapRouter address of new swap router
  function changeSwapRouter(address newSwapRouter) external;

  /// @notice Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist
  /// @dev quoteToken and baseToken may be passed in either token0/token1 or token1/token0 order
  /// @param quoteToken The contract address of stable-coin
  /// @param baseToken The contract address of the other token
  /// @param fee The fee collected upon every swap in the pool, denominated in hundredths of a bip
  /// @return pool The pool address
  function getPool(address quoteToken, address baseToken, uint24 fee) external view returns (address pool);

  /// @notice Returns swapRouter
  function swapRouter() external view returns (address);

  /// @notice Swap fee holder address
  function feeHolder() external view returns (address);

  /// @notice Address of wrapper
  function WETH9() external view returns (address);

  /// @notice Address of technical position
  function techPositionOwner() external view returns (address);
}
