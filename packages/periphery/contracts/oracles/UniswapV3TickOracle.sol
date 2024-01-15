// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import './IPriceOracle.sol';
import './libraries/OracleLib.sol';

contract UniswapV3TickOracle is IPriceOracle, Ownable2Step {
  struct OracleCalldata {
    uint16 secondsAgo;
    uint24 fee;
  }

  address public immutable factory;

  constructor(address _factory) {
    factory = _factory;
  }

  function validateOptions(address quoteToken, address baseToken, bytes calldata options) external view {
    OracleCalldata memory oracleCalldata = decode(options);
    if (oracleCalldata.secondsAgo == 0) revert();
    getPoolAddress(quoteToken, baseToken, oracleCalldata.fee);
  }

  function canChangeOptions(bytes calldata newOptions, bytes calldata oldOptions) external pure returns (bool) {
    OracleCalldata memory newOracleCalldata = decode(newOptions);
    return decode(oldOptions).fee == newOracleCalldata.fee && newOracleCalldata.secondsAgo != 0;
  }

  function getBalancePrice(
    address quoteToken,
    address baseToken,
    bytes calldata options
  ) external view returns (uint256) {
    return getPriceX96Inner(quoteToken, baseToken, options);
  }

  function getMargincallPrice(
    address quoteToken,
    address baseToken,
    bytes calldata options
  ) external view returns (uint256) {
    return getPriceX96Inner(quoteToken, baseToken, options);
  }

  function getPriceX96Inner(
    address quoteToken,
    address baseToken,
    bytes calldata options
  ) private view returns (uint256) {
    OracleCalldata memory oracleCalldata = decode(options);
    address pool = getPoolAddress(baseToken, quoteToken, oracleCalldata.fee);
    int24 arithmeticMeanTick = OracleLib.getArithmeticMeanTick(pool, oracleCalldata.secondsAgo);
    if (quoteToken < baseToken) {
      arithmeticMeanTick = -arithmeticMeanTick;
    }
    uint256 sqrtPrice = OracleLib.getSqrtRatioAtTick(arithmeticMeanTick);
    return sqrtPrice * sqrtPrice;
  }

  function decode(bytes calldata options) private pure returns (OracleCalldata memory) {
    return abi.decode(options, (OracleCalldata));
  }

  // TODO tmp impl, need to rewrite it so basically any UniswapV3-like factory can be supported
  // e.g. algebra is uniswapV3-like, but method with another name is used to get pools and it has no fee param
  // most likely can be achieved via `factory.call(bytes)` with necessary encoded method and params;
  function getPoolAddress(address tokenA, address tokenB, uint24 fee) private view returns (address pool) {
    pool = IUniswapV3Factory(factory).getPool(tokenA, tokenB, fee);
    if (pool == address(0)) revert();
  }
}
