// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '../libraries/OracleLib.sol';

contract MockMarginlyPoolWithPriceAdapter {
  address public uniswapPool;

  constructor(address _uniswapPool) {
    uniswapPool = _uniswapPool;
  }

  /// @notice returns uniswapV3 oracle TWAP sqrt price for `priceSecondsAgo` period
  function getTwapPrice(uint16 priceSecondsAgo) public view returns (uint256) {
    return OracleLib.getSqrtPriceX96(uniswapPool, priceSecondsAgo);
  }
}

