// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '../dex/dex.sol';

library Swaps {
  struct SwapInfo {
    Dex dex;
    uint16 swapRatio;
  }

  error WrongSwapsNumber();
  error WrongSwapRatios();

  uint256 constant MASK = 1048575; // 2^20 - 1
  uint256 constant SWAP_NUMBER_MASK = 15; // 2^4 - 1
  uint256 constant internal ONE = 32768; // 2^15

  function decodeSwapInfo(uint256 swaps) internal pure returns(SwapInfo[] memory swapInfos, uint256 swapsNumber) {
    unchecked {
      // default value
      if(swaps == 0) {
        swapInfos = new SwapInfo[](1);
        swapInfos[0] = SwapInfo({dex: Dex.UniswapV3, swapRatio: uint16(ONE)});
        return (swapInfos, 1);
      }

      swapsNumber = swaps & SWAP_NUMBER_MASK;
      if (swapsNumber == 0) revert WrongSwapsNumber();
      swapInfos = new SwapInfo[](swapsNumber);
      swaps >>= 4;

      uint16 swapRatiosSum;
      for(uint256 swap; swap < swapsNumber; ++swap) {
        uint256 swapInfo = swaps & MASK;
        uint16 swapRatio = uint16(swapInfo);
        swaps >>= 20;
        swapInfos[swap] = SwapInfo({dex: Dex(swapInfo >> 16), swapRatio: swapRatio});
        swapRatiosSum += swapRatio;
      }

      if(swapRatiosSum != ONE) revert WrongSwapRatios(); 
    }
  }
}