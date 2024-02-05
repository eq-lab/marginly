// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3FlashCallback.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@aave/core-v3/contracts/interfaces/IPool.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@marginly/router/contracts/interfaces/IMarginlyRouter.sol';
import './interfaces/IMarginlyPool.sol';
import './interfaces/IMarginlyFactory.sol';
import './dataTypes/Call.sol';

contract MarginlyKeeperUniswapV3 is IUniswapV3FlashCallback {
  using SafeERC20 for IERC20;
  /// @dev Emitted when liquidation occurs
  /// @param liquidatedPosition liquidated position
  /// @param token profit token
  /// @param amount profit amount
  event Profit(address indexed liquidatedPosition, address indexed token, uint256 amount);

  struct LiquidationParams {
    address asset;
    uint256 amount;
    address marginlyPool;
    address positionToLiquidate;
    address liquidator;
    address uniswapPool;
    uint256 minProfit;
    uint256 swapCallData;
  }

  /// @notice Takes flashloan in uniswap v3 pool to liquidate position in Marginly
  /// @param uniswapPool uniswap pool, source of flashloan
  /// @param amount0 borrow amount of uniswapV3.token0
  /// @param amount1 borrow amount of uniswapV3.token1
  /// @param params encoded LiquidationParams
  function liquidatePosition(address uniswapPool, uint256 amount0, uint256 amount1, bytes calldata params) external {
    require((amount0 > 0 && amount1 == 0) || (amount0 == 0 && amount1 > 0), 'Wrong amount');
    IUniswapV3Pool(uniswapPool).flash(address(this), amount0, amount1, params);
  }

  function uniswapV3FlashCallback(uint256 fee0, uint256 fee1, bytes calldata data) external {
    LiquidationParams memory decodedParams = abi.decode(data, (LiquidationParams));
    require(msg.sender == address(decodedParams.uniswapPool), 'Caller must be pool');

    _liquidateAndTakeProfit(fee0 + fee1, decodedParams);
  }

  /// @notice Position liquidation, collateral withdrawal and checks of profit
  function _liquidateAndTakeProfit(uint256 fee, LiquidationParams memory params) private {
    IMarginlyPool marginlyPool = IMarginlyPool(params.marginlyPool);
    address quoteToken = marginlyPool.quoteToken();
    address baseToken = marginlyPool.baseToken();
    address asset = params.asset;
    uint256 amount = params.amount;
    address positionToLiquidate = params.positionToLiquidate;

    address collateralToken;
    if (quoteToken == asset) {
      SafeERC20.forceApprove(IERC20(quoteToken), address(marginlyPool), amount);
      marginlyPool.execute(CallType.ReceivePosition, amount, 0, 0, false, positionToLiquidate, 0);
      collateralToken = baseToken;
    } else if (baseToken == asset) {
      SafeERC20.forceApprove(IERC20(baseToken), address(marginlyPool), amount);
      marginlyPool.execute(CallType.ReceivePosition, 0, amount, 0, false, positionToLiquidate, 0);
      collateralToken = quoteToken;
    } else {
      revert('Wrong asset');
    }

    marginlyPool.execute(CallType.WithdrawBase, type(uint256).max, 0, 0, false, address(0), 0);
    marginlyPool.execute(CallType.WithdrawQuote, type(uint256).max, 0, 0, false, address(0), 0);

    IMarginlyFactory marginlyFactory = IMarginlyFactory(marginlyPool.factory());

    uint256 dust = IERC20(asset).balanceOf(address(this));
    uint256 amountOut = _exactInputSwap(params.swapCallData, marginlyFactory.swapRouter(), collateralToken, asset);
    uint256 paybackAmount = amount + fee;
    require(amountOut + dust > paybackAmount, 'Insufficient funds to cover flashloan');

    uint256 profit = dust + amountOut - paybackAmount;
    require(profit >= params.minProfit, 'Less than minimum profit');

    IERC20(asset).safeTransfer(params.uniswapPool, paybackAmount);
    IERC20(asset).safeTransfer(params.liquidator, profit);

    emit Profit(positionToLiquidate, asset, profit);
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
