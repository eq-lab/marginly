// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import './IPriceOracle.sol';
import './libraries/OracleLib.sol';

contract UniswapV3TickOracleDouble is IPriceOracle, Ownable2Step {
  struct OracleCalldata {
    uint16 secondsAgo;
    uint24 firstPairFee;
    uint24 secondPairFee;
    address intermediateToken;
  }

  address public immutable factory;

  constructor(address _factory) {
    factory = _factory;
  }

  function validateOptions(address quoteToken, address baseToken, bytes calldata options) external view {
    OracleCalldata memory oracleCalldata = decode(options);
    if (oracleCalldata.secondsAgo == 0) revert();
    getPoolAddress(baseToken, oracleCalldata.intermediateToken, oracleCalldata.firstPairFee);
    getPoolAddress(quoteToken, oracleCalldata.intermediateToken, oracleCalldata.secondPairFee);
  }

  function canChangeOptions(bytes calldata newOptions, bytes calldata oldOptions) external pure returns (bool) {
    OracleCalldata memory oldOracleCalldata = decode(oldOptions);
    OracleCalldata memory newOracleCalldata = decode(newOptions);

    bool sameFirstPairFee = oldOracleCalldata.firstPairFee == newOracleCalldata.firstPairFee;
    bool sameSecondPairFee = oldOracleCalldata.secondPairFee == newOracleCalldata.secondPairFee;
    bool sameIntermediateToken = oldOracleCalldata.intermediateToken == newOracleCalldata.intermediateToken;
    bool secondsAgoIsCorrect = newOracleCalldata.secondsAgo != 0;

    return sameFirstPairFee && sameSecondPairFee && sameIntermediateToken && secondsAgoIsCorrect;
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
    OracleCalldata memory oracleCalldata = abi.decode(options, (OracleCalldata));
    address intermediateToken = oracleCalldata.intermediateToken;
    address firstPool = getPoolAddress(baseToken, intermediateToken, oracleCalldata.firstPairFee);
    address secondPool = getPoolAddress(quoteToken, intermediateToken, oracleCalldata.secondPairFee);

    // getting base/intermediate price
    int24 firstPoolTick = OracleLib.getArithmeticMeanTick(firstPool, oracleCalldata.secondsAgo);
    if (intermediateToken < baseToken) {
      firstPoolTick = -firstPoolTick;
    }

    // getting intermediate/quote price
    int24 secondPoolTick = OracleLib.getArithmeticMeanTick(secondPool, oracleCalldata.secondsAgo);
    if (quoteToken < intermediateToken) {
      secondPoolTick = -secondPoolTick;
    }

    // base/quote = base/intermediate * intermediate/quote
    int24 resultingTick = firstPoolTick + secondPoolTick;

    uint256 sqrtPrice = OracleLib.getSqrtRatioAtTick(resultingTick);

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
