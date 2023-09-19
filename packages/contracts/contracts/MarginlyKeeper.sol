// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanSimpleReceiver.sol';
import '@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol';
import '@aave/core-v3/contracts/interfaces/IPool.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@marginly/router/contracts/interfaces/IMarginlyRouter.sol';
import './interfaces/IMarginlyPool.sol';
import './interfaces/IMarginlyFactory.sol';
import './dataTypes/Call.sol';

/// @notice Contract helper for Marginly position liquidators.
/// @dev It make liquidation with help of AAVE flashloan
contract MarginlyKeeper is IFlashLoanSimpleReceiver {
  using SafeERC20 for IERC20;

  /// @dev Emitted when liquidation occurs
  /// @param liquidatedPosition liquidated position
  /// @param token profit token
  /// @param amount profit amount
  event Profit(address liquidatedPosition, address token, uint256 amount);

  struct LiquidationParams {
    address marginlyPool;
    address positionToLiquidate;
    address liquidator;
    uint256 minProfit;
  }

  IPoolAddressesProvider public immutable override ADDRESSES_PROVIDER;
  IPool public immutable override POOL;

  constructor(address addressesProvider) {
    ADDRESSES_PROVIDER = IPoolAddressesProvider(addressesProvider);
    POOL = IPool(ADDRESSES_PROVIDER.getPool());
  }

  /// @notice Takes simple flashloan in AAVE v3 protocol to liquidate position in Marginly
  /// @param asset borrow asset
  /// @param amount borrow amount
  /// @param referralCode referral code to get rewards in AAVE
  /// @param marginlyPool address of marginly pool
  /// @param positionToLiquidate address of liquidatable position in Marginly pool
  /// @param minProfit amount of minimum profit worth in borrow asset
  function flashLoan(
    address asset,
    uint256 amount,
    uint16 referralCode,
    address marginlyPool,
    address positionToLiquidate,
    uint256 minProfit
  ) external {
    bytes memory params = abi.encode(
      LiquidationParams({
        marginlyPool: marginlyPool,
        positionToLiquidate: positionToLiquidate,
        minProfit: minProfit,
        liquidator: msg.sender
      })
    );

    POOL.flashLoanSimple(address(this), asset, amount, params, referralCode);
  }

  /// @inheritdoc IFlashLoanSimpleReceiver
  function executeOperation(
    address asset,
    uint256 amount,
    uint256 premium,
    address initiator,
    bytes calldata data
  ) external override returns (bool) {
    require(msg.sender == address(POOL), 'Caller must be POOL');
    require(initiator == address(this), 'Initiator must be this contract');

    LiquidationParams memory decodedParams = abi.decode(data, (LiquidationParams));

    liquidateAndTakeProfit(asset, amount, premium, decodedParams);

    return true;
  }

  /// @notice Position liquidation, collateral withdrawal and checks of profit
  function liquidateAndTakeProfit(
    address asset,
    uint256 amount,
    uint256 premium,
    LiquidationParams memory params
  ) private {
    IMarginlyPool marginlyPool = IMarginlyPool(params.marginlyPool);

    address quoteToken = marginlyPool.quoteToken();
    address baseToken = marginlyPool.baseToken();

    address collateralToken;
    if (quoteToken == asset) {
      IERC20(quoteToken).approve(params.marginlyPool, amount);
      marginlyPool.execute(CallType.ReceivePosition, amount, 0, false, params.positionToLiquidate, 0);
      collateralToken = baseToken;
    } else if (baseToken == asset) {
      IERC20(baseToken).approve(params.marginlyPool, amount);
      marginlyPool.execute(CallType.ReceivePosition, 0, amount, false, params.positionToLiquidate, 0);
      collateralToken = quoteToken;
    } else {
      revert('Wrong asset');
    }

    marginlyPool.execute(CallType.WithdrawBase, type(uint256).max, 0, false, address(0), 0);
    marginlyPool.execute(CallType.WithdrawQuote, type(uint256).max, 0, false, address(0), 0);

    IMarginlyFactory marginlyFactory = IMarginlyFactory(marginlyPool.factory());

    uint256 dust = IERC20(asset).balanceOf(address(this));
    uint256 amountOut = exactInputSwap(marginlyFactory.swapRouter(), collateralToken, asset);
    uint256 paybackAmount = amount + premium;
    require(amountOut + dust > paybackAmount, 'Insufficient funds to cover flashloan');

    uint256 resultingBalance = dust + amountOut - paybackAmount;
    require(resultingBalance >= params.minProfit, 'Less than minimum profit');

    IERC20(asset).safeApprove(address(POOL), paybackAmount);

    IERC20(asset).safeTransfer(params.liquidator, resultingBalance);

    emit Profit(params.positionToLiquidate, asset, resultingBalance);
  }

  /// @notice Uniswap exchange
  function exactInputSwap(address swapRouter, address tokenIn, address tokenOut) private returns (uint256) {
    uint256 amountIn = IERC20(tokenIn).balanceOf(address(this));
    IERC20(tokenIn).safeApprove(swapRouter, amountIn);
    return IMarginlyRouter(swapRouter).swapExactInput(0, tokenIn, tokenOut, amountIn, 0);
  }
}
