// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

import './libraries/OracleLib.sol';

contract UniswapV3TickOracleDouble is IPriceOracle, Ownable2Step {
  error CannotChangeUnderlyingPool();
  error UnknownPool();
  error WrongValue();

  struct OracleParams {
    bool initialized;
    uint16 secondsAgo;
    uint16 secondsAgoLiquidation;
    uint24 baseTokenPairFee;
    uint24 quoteTokenPairFee;
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
    uint24 baseTokenPairFee,
    uint24 quoteTokenPairFee,
    address intermediateToken
  ) external onlyOwner {
    if (secondsAgo == 0 || secondsAgoLiquidation == 0) revert WrongValue();

    OracleParams storage currentParams = getParams[quoteToken][baseToken];
    if (currentParams.initialized) {
      if (
        currentParams.baseTokenPairFee != baseTokenPairFee ||
        currentParams.quoteTokenPairFee != quoteTokenPairFee ||
        currentParams.intermediateToken != intermediateToken
      ) revert CannotChangeUnderlyingPool();
    } else {
      getPoolAddress(quoteToken, intermediateToken, quoteTokenPairFee);
      getPoolAddress(baseToken, intermediateToken, baseTokenPairFee);
      currentParams.initialized = true;
      currentParams.baseTokenPairFee = baseTokenPairFee;
      currentParams.quoteTokenPairFee = quoteTokenPairFee;
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
    address firstPool = getPoolAddress(quoteToken, params.intermediateToken, params.quoteTokenPairFee);
    address secondPool = getPoolAddress(baseToken, params.intermediateToken, params.baseTokenPairFee);

    uint16 secondsAgo = isBalancePrice ? params.secondsAgo : params.secondsAgoLiquidation;

    // getting intermediate/quote price
    int24 firstPoolTick = OracleLib.getArithmeticMeanTick(firstPool, secondsAgo);
    if (quoteToken < params.intermediateToken) {
      firstPoolTick = -firstPoolTick;
    }

    // getting base/intermediate price
    int24 secondPoolTick = OracleLib.getArithmeticMeanTick(secondPool, secondsAgo);
    if (params.intermediateToken < baseToken) {
      secondPoolTick = -secondPoolTick;
    }

    // base/quote = base/intermediate * intermediate/quote
    int24 resultingTick = firstPoolTick + secondPoolTick;

    uint256 sqrtPrice = OracleLib.getSqrtRatioAtTick(resultingTick);

    return Math.mulDiv(sqrtPrice, sqrtPrice, X96ONE);
  }

  function decode(bytes memory options) private pure returns (OracleParams memory) {
    return abi.decode(options, (OracleParams));
  }

  function getPoolAddress(address tokenA, address tokenB, uint24 fee) private view returns (address pool) {
    pool = IUniswapV3Factory(factory).getPool(tokenA, tokenB, fee);
    if (pool == address(0)) revert UnknownPool();
  }
}
