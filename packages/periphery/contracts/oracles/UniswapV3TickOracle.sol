// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

import './libraries/OracleLib.sol';
import './libraries/TickMathLib.sol';

contract UniswapV3TickOracle is IPriceOracle, Ownable2Step {
  error CannotChangeUnderlyingPool();
  error UnknownPool();
  error WrongValue();

  struct OracleParams {
    bool initialized;
    uint16 secondsAgo;
    uint16 secondsAgoLiquidation;
    uint24 uniswapFee;
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
    uint24 uniswapFee
  ) external onlyOwner {
    if (secondsAgo == 0 || secondsAgoLiquidation == 0) revert WrongValue();
    if (secondsAgo < secondsAgoLiquidation) revert WrongValue();

    OracleParams storage currentParams = getParams[quoteToken][baseToken];
    if (currentParams.initialized) {
      if (currentParams.uniswapFee != uniswapFee) revert CannotChangeUnderlyingPool();
    } else {
      getPoolAddress(quoteToken, baseToken, uniswapFee);
      currentParams.uniswapFee = uniswapFee;
      currentParams.initialized = true;
    }

    currentParams.secondsAgo = secondsAgo;
    currentParams.secondsAgoLiquidation = secondsAgoLiquidation;
  }

  function getBalancePrice(address quoteToken, address baseToken) external view returns (uint256) {
    OracleParams storage params = getParams[quoteToken][baseToken];
    return getPriceX96Inner(quoteToken, baseToken, params.uniswapFee, params.secondsAgo);
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view returns (uint256) {
    OracleParams storage params = getParams[quoteToken][baseToken];
    return getPriceX96Inner(quoteToken, baseToken, params.uniswapFee, params.secondsAgoLiquidation);
  }

  function getPriceX96Inner(
    address quoteToken,
    address baseToken,
    uint24 fee,
    uint16 secondsAgo
  ) private view returns (uint256) {
    address pool = getPoolAddress(baseToken, quoteToken, fee);
    int24 arithmeticMeanTick = OracleLib.getArithmeticMeanTick(pool, secondsAgo);
    if (quoteToken < baseToken) {
      arithmeticMeanTick = -arithmeticMeanTick;
    }
    uint256 sqrtPrice = TickMathLib.getSqrtRatioAtTick(arithmeticMeanTick);
    return Math.mulDiv(sqrtPrice, sqrtPrice, X96ONE);
  }

  function getPoolAddress(address tokenA, address tokenB, uint24 fee) private view returns (address pool) {
    pool = IUniswapV3Factory(factory).getPool(tokenA, tokenB, fee);
    if (pool == address(0)) revert UnknownPool();
  }
}
