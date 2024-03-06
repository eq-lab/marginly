// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import './TickMathLib.sol';

/// @title Oracle library
/// @notice Provides functions to integrate with V3 pool oracle
library OracleLib {
  error ZeroSeconds();

  function getArithmeticMeanTick(address pool, uint32 secondsAgo) internal view returns (int24 arithmeticMeanTick) {
    if (secondsAgo == 0) revert ZeroSeconds();

    uint32[] memory secondsAgos = new uint32[](2);
    secondsAgos[0] = secondsAgo;
    secondsAgos[1] = 0;

    (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(secondsAgos);
    int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];

    arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(secondsAgo)));
    // Always round to negative infinity
    if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(uint56(secondsAgo)) != 0)) arithmeticMeanTick--;
  }
}
