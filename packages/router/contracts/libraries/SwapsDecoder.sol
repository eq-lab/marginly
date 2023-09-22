// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/utils/math/Math.sol';

library SwapsDecoder {
  struct SwapInfo {
    uint16 dexIndex;
    uint256 dexAmountIn;
    uint256 dexAmountOut;
  }

  error WrongSwapsNumber();
  error WrongSwapRatios();

  uint256 constant MASK = 4194303; // 2^22 - 1
  uint256 constant SWAP_NUMBER_MASK = 15; // 2^4 - 1
  uint256 internal constant ONE = 32768; // 2^15

  /// @dev encodedSwaps param structure:
  /// @dev last 4 bits: total number of swaps
  /// @dev then swaps as groups of 22 bits
  /// @dev the first 6 out of 22 bits represent dexIndex
  /// @dev the rest 16 out of 22 bits represent swap ratio
  function decodeSwapInfo(
    uint256 encodedSwaps,
    uint256 amountIn,
    uint256 amountOut
  ) internal pure returns (SwapInfo[] memory swapInfos) {
    unchecked {
      // default value
      if (encodedSwaps == 0) {
        swapInfos = new SwapInfo[](1);
        swapInfos[0] = SwapInfo({dexIndex: 0, dexAmountIn: amountIn, dexAmountOut: amountOut});
        return swapInfos;
      }

      uint256 swapsNumber = encodedSwaps & SWAP_NUMBER_MASK;
      if (swapsNumber == 0) revert WrongSwapsNumber();
      swapInfos = new SwapInfo[](swapsNumber);
      encodedSwaps >>= 4;

      uint16 swapRatiosSum;
      uint256 totalAmountIn;
      uint256 totalAmountOut;
      for (uint256 swap; swap < swapsNumber; ++swap) {
        uint256 swapInfo = encodedSwaps & MASK;
        uint16 swapRatio = uint16(swapInfo);
        swapRatiosSum += swapRatio;
        encodedSwaps >>= 22;

        bool isLastSwap = swap + 1 == swapsNumber;
        uint256 dexAmountIn = isLastSwap ? amountIn - totalAmountIn : Math.mulDiv(amountIn, swapRatio, ONE);
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
      if (encodedSwaps != 0) revert WrongSwapsNumber();
    }
  }
}
