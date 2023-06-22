// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../dex/dex.sol';

interface IMarginlyRouter {
  function swapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256);

  function swapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) external returns (uint256);
}
