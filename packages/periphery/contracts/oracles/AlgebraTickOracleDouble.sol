// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@cryptoalgebra/v1.9-core/contracts/interfaces/IAlgebraFactory.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

import './libraries/AlgebraOracleLib.sol';

contract AlgebraTickOracleDouble is IPriceOracle, Ownable2Step {
  error CannotChangeUnderlyingPool();
  error UnknownPool();
  error WrongValue();

  struct OracleParams {
    bool initialized;
    uint16 secondsAgo;
    uint16 secondsAgoLiquidation;
    address intermediateToken;
  }

  uint256 private constant X96ONE = 79228162514264337593543950336;

  mapping(address => mapping(address => OracleParams)) public getParams;
  address public immutable factory;

  constructor(address _factory) {
    factory = _factory;
  }

  function setOptions(
    address quoteToken,
    address baseToken,
    uint16 secondsAgo,
    uint16 secondsAgoLiquidation,
    address intermediateToken
  ) external onlyOwner {
    if (secondsAgo == 0 || secondsAgoLiquidation == 0) revert WrongValue();

    OracleParams storage currentParams = getParams[quoteToken][baseToken];
    if (currentParams.initialized) {
      if (currentParams.intermediateToken != intermediateToken) revert CannotChangeUnderlyingPool();
    } else {
      getPoolAddress(quoteToken, intermediateToken);
      getPoolAddress(baseToken, intermediateToken);
      currentParams.initialized = true;
      currentParams.intermediateToken = intermediateToken;
    }

    currentParams.secondsAgo = secondsAgo;
    currentParams.secondsAgoLiquidation = secondsAgoLiquidation;
  }

  function getBalancePrice(address quoteToken, address baseToken) external view returns (uint256) {
    OracleParams storage params = getParams[quoteToken][baseToken];
    return getPriceX96Inner(quoteToken, baseToken, params, true);
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view returns (uint256) {
    OracleParams storage params = getParams[quoteToken][baseToken];
    return getPriceX96Inner(quoteToken, baseToken, params, false);
  }

  function getPriceX96Inner(
    address quoteToken,
    address baseToken,
    OracleParams storage params,
    bool isBalancePrice
  ) private view returns (uint256) {
    address firstPool = getPoolAddress(quoteToken, params.intermediateToken);
    address secondPool = getPoolAddress(baseToken, params.intermediateToken);

    uint16 secondsAgo = isBalancePrice ? params.secondsAgo : params.secondsAgoLiquidation;

    // getting intermediate/quote price
    int24 firstPoolTick = AlgebraOracleLib.getArithmeticMeanTick(firstPool, secondsAgo);
    if (quoteToken < params.intermediateToken) {
      firstPoolTick = -firstPoolTick;
    }

    // getting base/intermediate price
    int24 secondPoolTick = AlgebraOracleLib.getArithmeticMeanTick(secondPool, secondsAgo);
    if (params.intermediateToken < baseToken) {
      secondPoolTick = -secondPoolTick;
    }

    // base/quote = base/intermediate * intermediate/quote
    int24 resultingTick = firstPoolTick + secondPoolTick;

    uint256 sqrtPrice = AlgebraOracleLib.getSqrtRatioAtTick(resultingTick);

    return Math.mulDiv(sqrtPrice, sqrtPrice, X96ONE);
  }

  function decode(bytes memory options) private pure returns (OracleParams memory) {
    return abi.decode(options, (OracleParams));
  }

  function getPoolAddress(address tokenA, address tokenB) private view returns (address pool) {
    pool = IAlgebraFactory(factory).poolByPair(tokenA, tokenB);
    if (pool == address(0)) revert UnknownPool();
  }
}
