// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@cryptoalgebra/v1.9-core/contracts/interfaces/pool/IAlgebraPoolActions.sol';
import '@cryptoalgebra/v1.9-core/contracts/interfaces/callback/IAlgebraFlashCallback.sol';
import './MarginlyKeeper.sol';

///@dev Provides functionality for liquidating positions in the Marginly protocol using flashloans from the Algebra pool.
contract MarginlyKeeperAlgebra is MarginlyKeeper, IAlgebraFlashCallback {
  struct LiquidationParams {
    address asset;
    uint256 amount;
    address marginlyPool;
    address positionToLiquidate;
    address liquidator;
    address algebraPool;
    uint256 minProfit;
    uint256 swapCallData;
  }

  /// @notice Takes flashloan in algebra pool to liquidate position in Marginly
  /// @param algebraPool algebra pool, source of flashloan
  /// @param amount0 borrow amount of algebra.token0
  /// @param amount1 borrow amount of algebra.token1
  /// @param params encoded LiquidationParams
  function liquidatePosition(address algebraPool, uint256 amount0, uint256 amount1, bytes calldata params) external {
    require((amount0 > 0 && amount1 == 0) || (amount0 == 0 && amount1 > 0), 'Wrong amount');
    IAlgebraPoolActions(algebraPool).flash(address(this), amount0, amount1, params);
  }

  function algebraFlashCallback(uint256 fee0, uint256 fee1, bytes calldata data) external {
    LiquidationParams memory decodedParams = abi.decode(data, (LiquidationParams));
    require(msg.sender == address(decodedParams.algebraPool), 'Caller must be pool');

    _liquidateAndTakeProfit(
      decodedParams.asset,
      decodedParams.amount,
      decodedParams.amount + fee0 + fee1,
      decodedParams.marginlyPool,
      decodedParams.positionToLiquidate,
      decodedParams.minProfit,
      decodedParams.liquidator,
      decodedParams.swapCallData
    );
  }
}
