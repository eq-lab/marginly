// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import './IPriceOracle.sol';
import './libraries/OracleLib.sol';

contract UniswapV3TickOracle is IPriceOracle, Ownable2Step {
  error CannotChangeUnderlyingPool();
  error UnknownPool();
  error WrongValue();

  struct OracleParams {
    uint16 secondsAgo;
    uint16 secondsAgoLiquidation;
    uint24 fee;
  }

  uint256 private constant X96ONE = 79228162514264337593543950336;

  mapping(address => mapping(address => bytes)) public getParamsEncoded;
  address public immutable factory;

  constructor(address _factory) {
    factory = _factory;
  }

  function setOptions(address quoteToken, address baseToken, bytes calldata encodedParams) external onlyOwner {
    OracleParams memory newParams = decode(encodedParams);
    if (newParams.secondsAgo == 0 || newParams.secondsAgoLiquidation == 0) revert WrongValue();

    bytes memory currentParamsEncoded = getParamsEncoded[quoteToken][baseToken];
    if (currentParamsEncoded.length == 0) {
      getPoolAddress(quoteToken, baseToken, newParams.fee);
    } else {
      OracleParams memory currentParams = decode(currentParamsEncoded);
      if (currentParams.fee != newParams.fee) revert CannotChangeUnderlyingPool();
    }

    getParamsEncoded[quoteToken][baseToken] = encodedParams;
  }

  function getBalancePrice(address quoteToken, address baseToken) external view returns (uint256) {
    OracleParams memory params = decode(getParamsEncoded[quoteToken][baseToken]);
    return getPriceX96Inner(quoteToken, baseToken, params.fee, params.secondsAgo);
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view returns (uint256) {
    OracleParams memory params = decode(getParamsEncoded[quoteToken][baseToken]);
    return getPriceX96Inner(quoteToken, baseToken, params.fee, params.secondsAgoLiquidation);
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
    uint256 sqrtPrice = OracleLib.getSqrtRatioAtTick(arithmeticMeanTick);
    return Math.mulDiv(sqrtPrice, sqrtPrice, X96ONE);
  }

  function decode(bytes memory options) private pure returns (OracleParams memory) {
    return abi.decode(options, (OracleParams));
  }

  // TODO tmp impl, need to rewrite it so basically any UniswapV3-like factory can be supported
  // e.g. algebra is uniswapV3-like, but method with another name is used to get pools and it has no fee param
  // most likely can be achieved via `factory.call(bytes)` with necessary encoded method and params;
  function getPoolAddress(address tokenA, address tokenB, uint24 fee) private view returns (address pool) {
    pool = IUniswapV3Factory(factory).getPool(tokenA, tokenB, fee);
    if (pool == address(0)) revert UnknownPool();
  }
}
