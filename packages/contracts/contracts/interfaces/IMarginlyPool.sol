// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import './IMarginlyPoolOwnerActions.sol';
import '../dataTypes/Mode.sol';
import '../libraries/FP96.sol';

interface IMarginlyPool is IMarginlyPoolOwnerActions {
  /// @dev Emited when margin call is took place
  /// @param user User that was reinited
  /// @param swapPriceX96 Price of swap worth in quote token as Q96
  event EnactMarginCall(address indexed user, uint256 swapPriceX96);

  /// @dev Emited when user deposit base token
  /// @param user Depositor
  /// @param amount Amount of token user deposited
  event DepositBase(address indexed user, uint256 amount);

  /// @dev Emited when user deposit quote token
  /// @param user Depositor
  /// @param amount Amount of token user deposited
  event DepositQuote(address indexed user, uint256 amount);

  /// @dev Emited when user withdraw base token
  /// @param user User
  /// @param amount Amount of token user withdrawn
  event WithdrawBase(address indexed user, uint256 amount);

  /// @dev Emited when user withdraw quote token
  /// @param user User
  /// @param amount Amount of token user withdrawn
  event WithdrawQuote(address indexed user, uint256 amount);

  /// @dev Emited when user shorts
  /// @param user Depositor
  /// @param amount Amount of token user deposited
  /// @param swapPriceX96 Price of swap worth in quote token as Q96
  event Short(address indexed user, uint256 amount, uint256 swapPriceX96);

  /// @dev Emitted when user make long position
  /// @param user User
  /// @param amount Amount of token user use in long position
  /// @param swapPriceX96 Price of swap worth in quote token as Q96
  event Long(address indexed user, uint256 amount, uint256 swapPriceX96);

  /// @dev Emited when user closed position
  /// @param user User
  /// @param token Collateral token
  /// @param collateralDelta Amount of collateral reduction
  /// @param swapPriceX96 Price of swap worth in quote token as Q96
  event ClosePosition(address indexed user, address indexed token, uint256 collateralDelta, uint256 swapPriceX96);

  /// @dev Emited when user deposit base token to increase base collateral coeff
  /// @param baseAmount Amount of base token
  event IncreaseBaseCollateralCoeff(uint256 baseAmount);

  /// @dev Emited when user deposit base token to increase base collateral coeff
  /// @param quoteAmount Amount of quote token
  event IncreaseQuoteCollateralCoeff(uint256 quoteAmount);

  /// @dev Emited when position liquidation happened
  /// @param liquidator Liquidator
  /// @param position Liquidated position
  event ReceivePosition(address indexed liquidator, address indexed position);

  /// @dev When system swithed to emergency mode
  /// @param mode Emergency mode
  event Emergency(Mode mode);

  /// @dev Emited when user make emergency withdraw
  /// @param who Position owner
  /// @param token Token of withdraw
  /// @param amount Amount of withdraw
  event EmergencyWithdraw(address indexed who, address indexed token, uint256 amount);

  /// @dev Emitted when user transfer their position to new owner
  /// @param from address of previous position owner
  /// @param to address of new position owner
  event PositionTransfer(address indexed from, address indexed to);

  /// @dev Initializes the pool
  function initialize(
    address quoteToken,
    address baseToken,
    uint24 uniswapFee,
    bool quoteTokenIsToken0,
    address uniswapPool,
    MarginlyParams memory _params
  ) external;

  /// @notice Returns the address of quote token from pool
  function quoteToken() external view returns (address token);

  /// @notice Returns the address of base token from pool
  function baseToken() external view returns (address token);

  /// @notice Returns the address of associated uniswap pool
  function uniswapPool() external view returns (address pool);

  /// @notice Returns the fee for uniswap pool
  function uniswapFee() external view returns (uint24 fee);

  /// @notice Returns true if the token0 in Uniswap pool is a stable-coin
  function quoteTokenIsToken0() external view returns (bool);

  /// @notice Returns address of Marginly factory
  function factory() external view returns (address);

  /// @notice Deposit base token
  /// @param amount Amount of base token
  function depositBase(uint256 amount) external;

  /// @notice Deposit quote token
  /// @param amount Amount of quote token
  function depositQuote(uint256 amount) external;

  /// @notice Withdraw base token
  /// @param amount Amount of base token
  function withdrawBase(uint256 amount) external;

  /// @notice Withdraw quote token
  /// @param amount Amount of quote token
  function withdrawQuote(uint256 amount) external;

  /// @notice Short with leverage
  /// @param baseAmount Amount of base token
  function short(uint256 baseAmount) external;

  /// @notice Short with leverage
  /// @param baseAmount Amount of base token
  function long(uint256 baseAmount) external;

  /// @notice Close position
  function closePosition() external;

  /// @notice Accrue interest, check and run margin call for riskiest positions
  function reinit() external;

  /// @notice Increase base balance and baseCollateralCoeff
  /// @param realBaseaAmount Amount of base token
  function increaseBaseCollateralCoeff(uint256 realBaseaAmount) external;

  /// @notice Increase quote balance and quoteCollateralCoeff
  /// @param realQuoteAmount Amount of quote token
  function increaseQuoteCollateralCoeff(uint256 realQuoteAmount) external;

  /// @notice Liquidate bad position and receive position collateral and debt
  /// @param badPositionAddress address of position to liquidate
  /// @param quoteAmount amount of quote token to be deposited
  /// @param baseAmount amount of base token to be deposited
  function receivePosition(address badPositionAddress, uint256 quoteAmount, uint256 baseAmount) external;

  /// @notice Withdraw position collateral in emergency mode
  function emergencyWithdraw() external;

  /// @notice Transfer position to new owner
  /// @param newOwner address of new position owner
  function transferPosition(address newOwner) external;
}
