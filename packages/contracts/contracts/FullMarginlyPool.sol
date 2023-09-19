// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import './MarginlyPool.sol';
import './libraries/Errors.sol';

contract FullMarginlyPool is MarginlyPool {
  constructor(
    address _quoteToken,
    address _baseToken,
    bool _quoteTokenIsToken0,
    address _uniswapPool,
    MarginlyParams memory _params
  ) MarginlyPool() {
    _initializeMarginlyPool(_quoteToken, _baseToken, _quoteTokenIsToken0, _uniswapPool, _params);
  }

  function initialize(
    address _quoteToken,
    address _baseToken,
    bool _quoteTokenIsToken0,
    address _uniswapPool,
    MarginlyParams calldata _params
  ) external override {
    if (factory != address(0)) revert Errors.Forbidden();
  }

  function getParams()
    external
    view
    returns (
      uint8 maxLeverage,
      uint16 priceSecondsAgo,
      uint24 interestRate,
      uint24 swapFee,
      uint24 positionSlippage,
      uint24 mcSlippage,
      uint184 positionMinAmount,
      uint184 quoteLimit
    )
  {
    maxLeverage = params.maxLeverage;
    priceSecondsAgo = params.priceSecondsAgo;
    interestRate = params.interestRate;
    swapFee = params.swapFee;
    positionSlippage = params.positionSlippage;
    mcSlippage = params.mcSlippage;
    positionMinAmount = params.positionMinAmount;
    quoteLimit = params.quoteLimit;
  }
}
