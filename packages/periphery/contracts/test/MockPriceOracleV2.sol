// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

contract MockPriceOracleV2 is IPriceOracle {
  uint256 private constant X96ONE = 79228162514264337593543950336;

  mapping(address => mapping(address => uint256)) public balancePrices;
  mapping(address => mapping(address => uint256)) public mcPrices;

  function setPrice(address quoteToken, address baseToken, uint256 balancePriceX96, uint256 mcPriceX96) public {
    balancePrices[quoteToken][baseToken] = balancePriceX96;
    balancePrices[baseToken][quoteToken] = Math.mulDiv(X96ONE, X96ONE, balancePriceX96);

    mcPrices[quoteToken][baseToken] = mcPriceX96;
    mcPrices[baseToken][quoteToken] = Math.mulDiv(X96ONE, X96ONE, mcPriceX96);
  }

  function getBalancePrice(address quoteToken, address baseToken) external view returns (uint256) {
    return balancePrices[quoteToken][baseToken];
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view returns (uint256) {
    return mcPrices[quoteToken][baseToken];
  }
}
