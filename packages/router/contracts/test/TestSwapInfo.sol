// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '../libraries/SwapsDecoder.sol';

contract TestSwapInfo {
  function decodeSwapInfo(uint256 swaps) public pure returns (SwapsDecoder.SwapInfo[] memory swapInfos, uint256 size) {
    return SwapsDecoder.decodeSwapInfo(swaps);
  }
}

