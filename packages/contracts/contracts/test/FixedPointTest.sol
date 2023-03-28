// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '../libraries/FP96.sol';

contract FixedPointTest {
  using FP96 for FP96.FixedPoint;
  FP96.FixedPoint public result;

  constructor() {
    result = FP96.FixedPoint({inner: 1});
  }

  function pow(FP96.FixedPoint memory base, uint256 exp) external {
    result = base.pow(exp);
  }

  function powTaylor(FP96.FixedPoint memory base, uint256 exp) external {
    result = base.powTaylor(exp);
  }
}
