// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import './IMarginlyPoolOwnerActions.sol';
import '../dataTypes/Mode.sol';
import '../libraries/FP96.sol';
import '../dataTypes/Position.sol';
import '../dataTypes/MarginlyParams.sol';

interface IMarginlyPool is IMarginlyPoolOwnerActions {
  /// @dev Emitted when margin call took place
  /// @param user User that was reinited
  /// @param swapPriceX96 Price of swap worth in quote token as Q96
  event EnactMarginCall(address indexed user, uint256 swapPriceX96);

  /// @dev Emitted when user deposited base token
  /// @param user Depositor
  /// @param amount Amount of token user deposited
  /// @param newPositionType User position type after deposit
  /// @param baseDiscountedAmount Discounted amount of base tokens after deposit
  event DepositBase(address indexed user, uint256 amount, PositionType newPositionType, uint256 baseDiscountedAmount);

  /// @dev Emitted when user deposited quote token
  /// @param user Depositor
  /// @param amount Amount of token user deposited
  /// @param newPositionType User position type after deposit
  /// @param quoteDiscountedAmount Discounted amount of quote tokens after deposit
  event DepositQuote(address indexed user, uint256 amount, PositionType newPositionType, uint256 quoteDiscountedAmount);

  /// @dev Emitted when user withdrew base token
  /// @param user User
  /// @param amount Amount of token user withdrew
  /// @param baseDiscountedDelta Discounted delta amount of base tokens user withdrew
  event WithdrawBase(address indexed user, uint256 amount, uint256 baseDiscountedDelta);

  /// @dev Emitted when user withdrew quote token
  /// @param user User
  /// @param amount Amount of token user withdrew
  /// @param quoteDiscountedDelta Discounted delta amount of quote tokens user withdrew
  event WithdrawQuote(address indexed user, uint256 amount, uint256 quoteDiscountedDelta);

  /// @dev Emitted when user shorted
  /// @param user Depositor
  /// @param amount Amount of token user deposited
  /// @param swapPriceX96 Price of swap worth in quote token as Q96
  /// @param quoteDiscountedDelta Discounted delta amount of quote tokens
  /// @param baseDiscountedDelta Discounted delta amount of base tokens
  event Short(
    address indexed user,
    uint256 amount,
    uint256 swapPriceX96,
    uint256 quoteDiscountedDelta,
    uint256 baseDiscountedDelta
  );

  /// @dev Emitted when user made long position
  /// @param user User
  /// @param amount Amount of token user use in long position
  /// @param swapPriceX96 Price of swap worth in quote token as Q96
  /// @param quoteDiscountedDelta Discounted delta amount of quote tokens
  /// @param baseDiscountedDelta Discounted delta amount of base tokens
  event Long(
    address indexed user,
    uint256 amount,
    uint256 swapPriceX96,
    uint256 quoteDiscountedDelta,
    uint256 baseDiscountedDelta
  );

  /// @dev Emitted when user closed position
  /// @param user User
  /// @param token Collateral token
  /// @param collateralDelta Amount of collateral reduction
  /// @param swapPriceX96 Price of swap worth in quote token as Q96
  /// @param collateralDiscountedDelta Amount of discounted collateral reduction
  event ClosePosition(
    address indexed user,
    address indexed token,
    uint256 collateralDelta,
    uint256 swapPriceX96,
    uint256 collateralDiscountedDelta
  );

  /// @dev Emitted when position liquidation happened
  /// @param liquidator Liquidator
  /// @param position Liquidated position
  /// @param newPositionType Type of tx sender new position
  /// @param newPositionQuoteDiscounted Discounted amount of quote tokens for new position
  /// @param newPositionBaseDiscounted Discounted amount of base tokens for new position
  event ReceivePosition(
    address indexed liquidator,
    address indexed position,
    PositionType newPositionType,
    uint256 newPositionQuoteDiscounted,
    uint256 newPositionBaseDiscounted
  );

  /// @dev When system switched to emergency mode
  /// @param mode Emergency mode
  event Emergency(Mode mode);

  /// @dev Emitted when user made emergency withdraw
  /// @param who Position owner
  /// @param token Token of withdraw
  /// @param amount Amount of withdraw
  event EmergencyWithdraw(address indexed who, address indexed token, uint256 amount);

  /// @dev Emitted when reinit happened
  /// @param reinitTimestamp timestamp when reinit happened
  event Reinit(uint256 reinitTimestamp);

//  /// @dev Initializes the pool
//  function initialize(
//    address quoteToken,
//    address baseToken,
//    uint24 uniswapFee,
//    bool quoteTokenIsToken0,
//    address uniswapPool,
//    MarginlyParams memory _params
//  ) external;

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
  /// @param amount Amount of base token to deposit
  /// @param longAmount Amount of base token to open long position
  function depositBase(uint256 amount, uint256 longAmount) external payable;

  /// @notice Deposit quote token
  /// @param amount Amount of quote token
  /// @param shortAmount Amount of base token to open short position
  function depositQuote(uint256 amount, uint256 shortAmount) external payable;

  /// @notice Withdraw base token
  /// @param amount Amount of base token
  /// @param unwrapWETH flag to unwrap WETH to ETH
  function withdrawBase(uint256 amount, bool unwrapWETH) external;

  /// @notice Withdraw quote token
  /// @param amount Amount of quote token
  /// @param unwrapWETH flag to unwrap WETH to ETH
  function withdrawQuote(uint256 amount, bool unwrapWETH) external;

  /// @notice Short with leverage
  /// @param baseAmount Amount of base token
  function short(uint256 baseAmount) external;

  /// @notice Long with leverage
  /// @param baseAmount Amount of base token
  function long(uint256 baseAmount) external;

  /// @notice Close position
  function closePosition() external;

  /// @notice Accrue interest, check and run margin call for riskiest positions
  function reinit() external;

  /// @notice Liquidate bad position and receive position collateral and debt
  /// @param badPositionAddress address of position to liquidate
  /// @param quoteAmount amount of quote token to be deposited
  /// @param baseAmount amount of base token to be deposited
  function receivePosition(address badPositionAddress, uint256 quoteAmount, uint256 baseAmount) external;

  /// @notice Withdraw position collateral in emergency mode
  /// @param unwrapWETH flag to unwrap WETH to ETH
  function emergencyWithdraw(bool unwrapWETH) external;
}