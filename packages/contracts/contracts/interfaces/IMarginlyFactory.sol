// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '../dataTypes/MarginlyParams.sol';

interface IMarginlyFactory {
  /// @notice Emitted when a pool is created
  /// @param quoteToken The stable-coin
  /// @param baseToken The base token
  /// @param priceOracle Address of price oracle
  /// @param defaultSwapCallData Default swap call data for MC swaps
  /// @param pool The address of the created pool
  event PoolCreated(
    address indexed quoteToken,
    address indexed baseToken,
    address indexed priceOracle,
    uint32 defaultSwapCallData,
    address pool
  );

  /// @notice Emitted when changeSwapRouter was executed
  /// @param newSwapRouter new swap router address
  event SwapRouterChanged(address indexed newSwapRouter);

  /// @notice Creates a pool for the two given tokens and fee
  /// @param quoteToken One of the two tokens in the desired pool
  /// @param baseToken The other of the two tokens in the desired pool
  /// @param params pool parameters
  /// @param priceOracle price oracle to get base token price
  /// @param defaultSwapCallData default swap call data
  /// @dev tokenA and tokenB may be passed in either order: token0/token1 or token1/token0. tickSpacing is retrieved
  /// from the fee. The call will revert if the pool already exists, the fee is invalid, or the token arguments
  /// are invalid.
  /// @return pool The address of the newly created pool
  function createPool(
    address quoteToken,
    address baseToken,
    address priceOracle,
    uint32 defaultSwapCallData,
    MarginlyParams calldata params
  ) external returns (address pool);

  /// @notice Changes swap router address used by Marginly pools
  /// @param newSwapRouter address of new swap router
  function changeSwapRouter(address newSwapRouter) external;

  /// @notice Returns swapRouter
  function swapRouter() external view returns (address);

  /// @notice Swap fee holder address
  function feeHolder() external view returns (address);

  /// @notice Address of wrapper
  function WETH9() external view returns (address);

  /// @notice Address of technical position
  function techPositionOwner() external view returns (address);

  /// @notice Address of manager contract
  function manager() external view returns (address);
}
