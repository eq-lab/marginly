// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@marginly/router/contracts/interfaces/IMarginlyRouter.sol';
import '../interfaces/IMarginlyPool.sol';
import '../interfaces/IMarginlyFactory.sol';
import '../dataTypes/Call.sol';

/// @notice Contract helper for Marginly position liquidators.
/// @dev It make liquidation with help of AAVE flashloan
abstract contract MarginlyKeeper {
  using SafeERC20 for IERC20;

  /// @dev Emitted when liquidation occurs
  /// @param liquidatedPosition liquidated position
  /// @param token profit token
  /// @param amount profit amount
  event Profit(address indexed liquidatedPosition, address indexed token, uint256 amount);

  /// @notice Position liquidation, collateral withdrawal and checks of profit
  function _liquidateAndTakeProfit(
    address asset,
    uint256 amount,
    uint256 paybackAmount,
    address marginlyPoolAddress,
    address positionToLiquidate,
    uint256 minProfit,
    address liquidator,
    uint256 swapCallData
  ) internal {
    IMarginlyPool marginlyPool = IMarginlyPool(marginlyPoolAddress);

    address collateralToken;
    {
      address quoteToken = marginlyPool.quoteToken();
      address baseToken = marginlyPool.baseToken();
      if (quoteToken == asset) {
        SafeERC20.forceApprove(IERC20(quoteToken), marginlyPoolAddress, amount);
        marginlyPool.execute(CallType.ReceivePosition, amount, 0, 0, false, positionToLiquidate, 0);
        collateralToken = baseToken;
      } else if (baseToken == asset) {
        SafeERC20.forceApprove(IERC20(baseToken), marginlyPoolAddress, amount);
        marginlyPool.execute(CallType.ReceivePosition, 0, int256(amount), 0, false, positionToLiquidate, 0);
        collateralToken = quoteToken;
      } else {
        revert('Wrong asset');
      }
    }

    marginlyPool.execute(CallType.WithdrawBase, type(uint256).max, 0, 0, false, address(0), 0);
    marginlyPool.execute(CallType.WithdrawQuote, type(uint256).max, 0, 0, false, address(0), 0);

    uint256 amountOutWithDust = IERC20(asset).balanceOf(address(this));
    amountOutWithDust += _exactInputSwap(
      swapCallData,
      IMarginlyFactory(marginlyPool.factory()).swapRouter(),
      collateralToken,
      asset
    );
    require(amountOutWithDust > paybackAmount, 'Insufficient funds to cover flashloan');

    uint256 profit = amountOutWithDust - paybackAmount;
    require(profit >= minProfit, 'Less than minimum profit');

    _transferPayback(asset, paybackAmount);

    IERC20(asset).safeTransfer(liquidator, profit);

    emit Profit(positionToLiquidate, asset, profit);
  }

  function _transferPayback(address token, uint256 amount) internal virtual {
    IERC20(token).safeTransfer(msg.sender, amount);
  }

  /// @dev Exchange in MarginlyRouter
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
