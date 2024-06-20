// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3FlashCallback.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import './MarginlyKeeper.sol';

contract MarginlyKeeperUniswapV3 is MarginlyKeeper, IUniswapV3FlashCallback {
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
