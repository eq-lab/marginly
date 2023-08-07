// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '../libraries/SwapInfo.sol';

contract TestSwapInfo {
  function decodeSwapInfo(uint256 swaps) public pure returns (Swaps.SwapInfo[] memory swapInfos, uint256 size) {
    return Swaps.decodeSwapInfo(swaps);
  }
}

