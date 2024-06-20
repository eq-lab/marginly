// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanSimpleReceiver.sol';
import '@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol';
import '@aave/core-v3/contracts/interfaces/IPool.sol';
import './MarginlyKeeper.sol';

/// @notice Contract helper for Marginly position liquidators.
/// @dev It make liquidation with help of AAVE flashloan
contract MarginlyKeeperAave is MarginlyKeeper, IFlashLoanSimpleReceiver {
  struct LiquidationParams {
    address marginlyPool;
    address positionToLiquidate;
    address liquidator;
    uint256 minProfit;
    uint256 swapCallData;
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
  /// @param marginlyPool address of marginly pool
  /// @param positionToLiquidate address of liquidatable position in Marginly pool
  /// @param minProfit amount of minimum profit worth in borrow asset
  function flashLoan(
    address asset,
    uint256 amount,
    address marginlyPool,
    address positionToLiquidate,
    uint256 minProfit,
    uint256 swapCallData
  ) external {
    bytes memory params = abi.encode(
      LiquidationParams({
        marginlyPool: marginlyPool,
        positionToLiquidate: positionToLiquidate,
        minProfit: minProfit,
        liquidator: msg.sender,
        swapCallData: swapCallData
      })
    );

    POOL.flashLoanSimple(address(this), asset, amount, params, 0);
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

    _liquidateAndTakeProfit(
      asset,
      amount,
      amount + premium,
      decodedParams.marginlyPool,
      decodedParams.positionToLiquidate,
      decodedParams.minProfit,
      decodedParams.liquidator,
      decodedParams.swapCallData
    );

    return true;
  }

  function _transferPayback(address asset, uint256 amount) internal override {
    SafeERC20.forceApprove(IERC20(asset), msg.sender, amount);
  }
}
