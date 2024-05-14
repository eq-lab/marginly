// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

contract MockPriceOracle is IPriceOracle {
  uint256 balancePriceX96;
  uint256 margincallPriceX96;

  constructor(uint256 _balancePriceX96, uint256 _margincallPriceX96) {
    balancePriceX96 = _balancePriceX96;
    margincallPriceX96 = _margincallPriceX96;
  }

  function setPrice(uint256 newBalancePriceX96, uint256 newMargincallPriceX96) public {
    balancePriceX96 = newBalancePriceX96;
    margincallPriceX96 = newMargincallPriceX96;
  }

  function getBalancePrice(address /* quoteToken */, address /* baseToken */) external view returns (uint256) {
    return balancePriceX96;
  }

  function getMargincallPrice(address /* quoteToken */, address /* baseToken */) external view returns (uint256) {
    return margincallPriceX96;
  }
}
