// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import './IMarginlyOracle.sol';
import './libraries/OracleLib.sol';

contract UniswapV3TickOracle is IMarginlyOracle, Ownable2Step {
  struct OracleCalldata {
    uint16 secondsAgo;
    uint24 fee;
  }

  uint256 private constant Q96 = 1 << 96;

  address public immutable factory;

  constructor(address _factory) {
    factory = _factory;
  }

  function initialize() external {}

  function getBasePriceX96(
    address baseToken,
    address quoteToken,
    bytes calldata oracleCalldata
  ) external view returns (uint256) {
    return getPriceX96Inner(baseToken, quoteToken, oracleCalldata);
  }

  function getLiquidationPriceX96(
    address baseToken,
    address quoteToken,
    bytes calldata oracleCalldata
  ) external view returns (uint256) {
    return getPriceX96Inner(baseToken, quoteToken, oracleCalldata);
  }

  function getPriceX96Inner(
    address baseToken,
    address quoteToken,
    bytes calldata encodedOracleCalldata
  ) private view returns (uint256) {
    OracleCalldata memory oracleCalldata = abi.decode(encodedOracleCalldata, (OracleCalldata));
    address pool = getPoolAddress(baseToken, quoteToken, oracleCalldata.fee);
    int24 arithmeticMeanTick = OracleLib.getArithmeticMeanTick(pool, oracleCalldata.secondsAgo);
    if (quoteToken < baseToken) {
      arithmeticMeanTick = -arithmeticMeanTick;
    }
    return OracleLib.getSqrtRatioAtTick(arithmeticMeanTick);
  }

  // TODO tmp impl, need to rewrite it so basically any UniswapV3-like factory can be supported
  // e.g. algebra is uniswapV3-like, but method with another name is used to get pools and it has no fee param
  // most likely can be achieved via `factory.call(bytes)` with necessary encoded method and params;
  function getPoolAddress(address tokenA, address tokenB, uint24 fee) private view returns (address pool) {
    pool = IUniswapV3Factory(factory).getPool(tokenA, tokenB, fee);
    if (pool == address(0)) revert();
  }
}
