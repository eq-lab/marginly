// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@marginly/router/contracts/interfaces/IMarginlyRouter.sol';
import './interfaces/IMarginlyPool.sol';
import './interfaces/IMarginlyFactory.sol';
import './dataTypes/Call.sol';

interface IVault {
  function flashLoan(
    IFlashLoanRecipient recipient,
    IERC20[] memory tokens,
    uint256[] memory amounts,
    bytes memory userData
  ) external;
}

interface IFlashLoanRecipient {
  function receiveFlashLoan(
    IERC20[] memory tokens,
    uint256[] memory amounts,
    uint256[] memory feeAmounts,
    bytes memory userData
  ) external;
}

contract MarginlyKeeperBalancer is IFlashLoanRecipient {
  using SafeERC20 for IERC20;

  error ZeroAddress();
  error WrongAmount();
  error WrongCaller();

  /// @dev Emitted when liquidation occurs
  /// @param liquidatedPosition liquidated position
  /// @param token profit token
  /// @param amount profit amount
  event Profit(address indexed liquidatedPosition, address indexed token, uint256 amount);

  struct LiquidationParams {
    address marginlyPool;
    address positionToLiquidate;
    address liquidator;
    uint256 minProfit;
    uint256 swapCallData;
  }

  IVault public balancerVault;

  constructor(IVault _balancerVault) {
    if (address(_balancerVault) == address(0)) revert ZeroAddress();

    balancerVault = _balancerVault;
  }

  /// @notice Takes flashloan in uniswap v3 pool to liquidate position in Marginly
  /// @param token Token to borrow
  /// @param amount amount to borrow
  /// @param params encoded LiquidationParams
  function liquidatePosition(address token, uint256 amount, bytes calldata params) external {
    if (amount == 0) revert WrongAmount();
    if (address(token) == address(0)) revert ZeroAddress();

    IERC20[] memory tokens = new IERC20[](1);
    tokens[0] = IERC20(token);

    uint256[] memory amounts = new uint256[](1);
    amounts[0] = amount;

    balancerVault.flashLoan(this, tokens, amounts, params);
  }

  function receiveFlashLoan(
    IERC20[] memory tokens,
    uint256[] memory amounts,
    uint256[] memory feeAmounts,
    bytes memory data
  ) external {
    if (msg.sender != address(balancerVault)) revert WrongCaller();

    LiquidationParams memory liquidateionParams = abi.decode(data, (LiquidationParams));

    _liquidateAndTakeProfit(tokens[0], amounts[0], feeAmounts[0], liquidateionParams);
  }

  /// @notice Position liquidation, collateral withdrawal and checks of profit
  function _liquidateAndTakeProfit(IERC20 asset, uint256 amount, uint256 fee, LiquidationParams memory params) private {
    IMarginlyPool marginlyPool = IMarginlyPool(params.marginlyPool);
    address positionToLiquidate = params.positionToLiquidate;

    address collateralToken;
    {
      address quoteToken = marginlyPool.quoteToken();
      address baseToken = marginlyPool.baseToken();

      if (quoteToken == address(asset)) {
        SafeERC20.forceApprove(IERC20(quoteToken), address(marginlyPool), amount);
        marginlyPool.execute(CallType.ReceivePosition, amount, 0, 0, false, positionToLiquidate, 0);
        collateralToken = baseToken;
      } else if (baseToken == address(asset)) {
        SafeERC20.forceApprove(IERC20(baseToken), address(marginlyPool), amount);
        marginlyPool.execute(CallType.ReceivePosition, 0, int256(amount), 0, false, positionToLiquidate, 0);
        collateralToken = quoteToken;
      } else {
        revert('Wrong asset');
      }
    }
    marginlyPool.execute(CallType.WithdrawBase, type(uint256).max, 0, 0, false, address(0), 0);
    marginlyPool.execute(CallType.WithdrawQuote, type(uint256).max, 0, 0, false, address(0), 0);

    IMarginlyFactory marginlyFactory = IMarginlyFactory(marginlyPool.factory());

    uint256 dust = IERC20(asset).balanceOf(address(this));
    uint256 amountOut = _exactInputSwap(
      params.swapCallData,
      marginlyFactory.swapRouter(),
      collateralToken,
      address(asset)
    );
    uint256 paybackAmount = amount + fee;
    require(amountOut + dust > paybackAmount, 'Insufficient funds to cover flashloan');

    uint256 profit = dust + amountOut - paybackAmount;
    require(profit >= params.minProfit, 'Less than minimum profit');

    asset.safeTransfer(msg.sender, paybackAmount);
    asset.safeTransfer(params.liquidator, profit);

    emit Profit(positionToLiquidate, address(asset), profit);
  }

  /// @notice Exchange
  function _exactInputSwap(
    uint256 swapCallData,
    address swapRouter,
    address tokenIn,
    address tokenOut
  ) private returns (uint256) {
    uint256 amountIn = IERC20(tokenIn).balanceOf(address(this));
    SafeERC20.forceApprove(IERC20(tokenIn), swapRouter, amountIn);
    return IMarginlyRouter(swapRouter).swapExactInput(swapCallData, tokenIn, tokenOut, amountIn, 0);
  }
}
