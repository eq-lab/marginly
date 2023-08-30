// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/utils/math/Math.sol';

library SwapsDecoder {
  struct SwapInfo {
    uint16 dexIndex;
    uint256 dexAmountIn;
    uint256 dexAmountOut;
  }

  error WrongSwapsNumber();
  error WrongSwapRatios();

  uint256 constant MASK = 1048575; // 2^20 - 1
  uint256 constant SWAP_NUMBER_MASK = 15; // 2^4 - 1
  uint256 internal constant ONE = 32768; // 2^15

  function decodeSwapInfo(
    uint256 swaps,
    uint256 amountIn,
    uint256 amountOut
  ) internal pure returns (SwapInfo[] memory swapInfos, uint256 swapsNumber) {
    unchecked {
      // default value
      if (swaps == 0) {
        swapInfos = new SwapInfo[](1);
        swapInfos[0] = SwapInfo({dexIndex: 0, dexAmountIn: amountIn, dexAmountOut: amountOut});
        return (swapInfos, 1);
      }

      swapsNumber = swaps & SWAP_NUMBER_MASK;
      if (swapsNumber == 0) revert WrongSwapsNumber();
      swapInfos = new SwapInfo[](swapsNumber);
      swaps >>= 4;

      uint16 swapRatiosSum;
      uint256 totalAmountIn;
      uint256 totalAmountOut;
      for (uint256 swap; swap < swapsNumber; ++swap) {
        uint256 swapInfo = swaps & MASK;
        uint16 swapRatio = uint16(swapInfo);
        swapRatiosSum += swapRatio;
        swaps >>= 20;

        bool isLastSwap = swap + 1 == swapsNumber;
        uint256 dexAmountIn = isLastSwap ? amountIn - totalAmountIn : Math.mulDiv(amountIn, swapRatio, ONE) ;
        totalAmountIn += dexAmountIn;
        uint256 dexAmountOut = isLastSwap ? amountOut - totalAmountOut : Math.mulDiv(amountOut, swapRatio, ONE);
        totalAmountOut += dexAmountOut;

        swapInfos[swap] = SwapInfo({
          dexIndex: uint16(swapInfo >> 16),
          dexAmountIn: dexAmountIn,
          dexAmountOut: dexAmountOut
        });
      }

      if (swapRatiosSum != ONE) revert WrongSwapRatios();
      if (swaps != 0) revert WrongSwapsNumber();
    }
  }
}
