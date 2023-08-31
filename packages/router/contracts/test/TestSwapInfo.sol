// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '../libraries/SwapsDecoder.sol';

contract TestSwapInfo {
  function decodeSwapInfo(
    uint256 swaps,
    uint256 amountIn,
    uint256 amountOut
  ) public pure returns (SwapsDecoder.SwapInfo[] memory swapInfos, uint256 size) {
    swapInfos = SwapsDecoder.decodeSwapInfo(swaps, amountIn, amountOut);
    return (swapInfos, swapInfos.length);
  }
}
