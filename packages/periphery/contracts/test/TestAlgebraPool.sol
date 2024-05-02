// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

contract TestAlgebraPool {
  address public token0;
  address public token1;

  uint160 public token1ToToken0SqrtPriceX96 = 0x02000000000000000000000000;
  int56 public tickCumulativesSecond = 13863;

  constructor(address tokenA, address tokenB) {
    (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
  }

  function setTokenPriceAndTickCumulative(uint160 _token1ToToken1SqrtPriceX96, int56 _tickCumulativesSecond) external {
    token1ToToken0SqrtPriceX96 = _token1ToToken1SqrtPriceX96;
    tickCumulativesSecond = _tickCumulativesSecond;
  }

  function getTimepoints(
    uint32[] calldata secondsAgos
  )
    external
    view
    returns (
      int56[] memory tickCumulatives,
      uint160[] memory secondsPerLiquidityCumulatives,
      uint112[] memory volatilityCumulatives,
      uint256[] memory volumePerAvgLiquiditys
    )
  {
    tickCumulatives = new int56[](2);
    tickCumulatives[0] = 0;
    tickCumulatives[1] = tickCumulativesSecond * int56(uint56(secondsAgos[0] - secondsAgos[1]));

    secondsPerLiquidityCumulatives = new uint160[](2);
    volatilityCumulatives = new uint112[](2);
    volumePerAvgLiquiditys = new uint256[](2);
  }
}
