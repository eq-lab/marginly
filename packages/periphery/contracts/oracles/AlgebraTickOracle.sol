// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@cryptoalgebra/v1.9-core/contracts/interfaces/IAlgebraFactory.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

import './libraries/AlgebraOracleLib.sol';
import './libraries/TickMathLib.sol';

contract AlgebraTickOracle is IPriceOracle, Ownable2Step {
  error UnknownPool();
  error WrongValue();

  struct OracleParams {
    bool initialized;
    uint16 secondsAgo;
    uint16 secondsAgoLiquidation;
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
    uint16 secondsAgoLiquidation
  ) external onlyOwner {
    if (secondsAgo == 0 || secondsAgoLiquidation == 0) revert WrongValue();
    if (secondsAgo < secondsAgoLiquidation) revert WrongValue();

    OracleParams storage currentParams = getParams[quoteToken][baseToken];
    if (!currentParams.initialized) {
      getPoolAddress(quoteToken, baseToken);
      currentParams.initialized = true;
    }

    currentParams.secondsAgo = secondsAgo;
    currentParams.secondsAgoLiquidation = secondsAgoLiquidation;
  }

  function getBalancePrice(address quoteToken, address baseToken) external view returns (uint256) {
    OracleParams storage params = getParams[quoteToken][baseToken];
    return getPriceX96Inner(quoteToken, baseToken, params.secondsAgo);
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view returns (uint256) {
    OracleParams storage params = getParams[quoteToken][baseToken];
    return getPriceX96Inner(quoteToken, baseToken, params.secondsAgoLiquidation);
  }

  function getPriceX96Inner(address quoteToken, address baseToken, uint16 secondsAgo) private view returns (uint256) {
    address pool = getPoolAddress(baseToken, quoteToken);
    int24 arithmeticMeanTick = AlgebraOracleLib.getArithmeticMeanTick(pool, secondsAgo);
    if (quoteToken < baseToken) {
      arithmeticMeanTick = -arithmeticMeanTick;
    }
    uint256 sqrtPrice = TickMathLib.getSqrtRatioAtTick(arithmeticMeanTick);
    return Math.mulDiv(sqrtPrice, sqrtPrice, X96ONE);
  }

  function getPoolAddress(address tokenA, address tokenB) private view returns (address pool) {
    pool = IAlgebraFactory(factory).poolByPair(tokenA, tokenB);
    if (pool == address(0)) revert UnknownPool();
  }
}
