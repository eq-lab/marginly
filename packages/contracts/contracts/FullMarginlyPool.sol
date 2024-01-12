// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import './MarginlyPool.sol';
import './libraries/Errors.sol';

contract FullMarginlyPool is MarginlyPool {
  bool public initialized = false;

  constructor(
    address _quoteToken,
    address _baseToken,
    address _priceOracle,
    MarginlyParams memory _params
  ) MarginlyPool() {}

  function initialize(
    address _quoteToken,
    address _baseToken,
    address _priceOracle,
    MarginlyParams calldata _params
  ) external override {
    if (initialized) revert Errors.Forbidden();

    _initializeMarginlyPool(_quoteToken, _baseToken, _priceOracle, _params);
    initialized = true;
  }

  function getParams()
    external
    view
    returns (
      uint8 maxLeverage,
      uint24 interestRate,
      uint24 swapFee,
      uint24 mcSlippage,
      uint184 positionMinAmount,
      uint184 quoteLimit
    )
  {
    maxLeverage = params.maxLeverage;
    interestRate = params.interestRate;
    swapFee = params.swapFee;
    mcSlippage = params.mcSlippage;
    positionMinAmount = params.positionMinAmount;
    quoteLimit = params.quoteLimit;
  }
}
