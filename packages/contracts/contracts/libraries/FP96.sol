// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

library FP96 {
  /// @dev Bits precision of FixedPoint number
  uint8 internal constant RESOLUTION = 96;
  /// @dev Denominator for FixedPoint number
  uint256 internal constant Q96 = 0x1000000000000000000000000;
  /// @dev Maximum value of FixedPoint number
  uint256 internal constant INNER_MAX = type(uint256).max;
  /// @dev Representation for FixedPoint number
  struct FixedPoint {
    uint256 inner;
  }

  /// @dev Returns one in FixedPoint representation
  function one() internal pure returns (FixedPoint memory result) {
    result.inner = Q96;
  }

  /// @dev Returns zero in FixedPoint representation
  function zero() internal pure returns (FixedPoint memory result) {
    result.inner = uint256(0);
  }

  /// @dev Create FixedPoint number from ratio
  /// @param nom Ratio nominator
  /// @param den Ratio denominator
  /// @return result Ratio representation
  function fromRatio(uint256 nom, uint256 den) internal pure returns (FixedPoint memory result) {
    result.inner = Math.mulDiv(Q96, nom, den);
  }

  /// @notice Add two FixedPoint numbers
  /// @param self The augend
  /// @param other The addend
  /// @return result The sum of self and other
  function add(FixedPoint memory self, FixedPoint memory other) internal pure returns (FixedPoint memory result) {
    result.inner = LowGasSafeMath.add(self.inner, other.inner);
  }

  /// @notice Subtract two FixedPoint numbers
  /// @param self The minuend
  /// @param other The subtrahend
  /// @return result The difference of self and other
  function sub(FixedPoint memory self, FixedPoint memory other) internal pure returns (FixedPoint memory result) {
    result.inner = LowGasSafeMath.sub(self.inner, other.inner);
  }

  /// @notice Multiply two FixedPoint numbers
  /// @param self The multiplicand
  /// @param other The multiplier
  /// @return result The product of self and other
  function mul(FixedPoint memory self, FixedPoint memory other) internal pure returns (FixedPoint memory result) {
    result.inner = Math.mulDiv(self.inner, other.inner, Q96);
  }

  /// @notice Exponentiation base ^ exponent
  /// @param self The base
  /// @param exponent The exponent
  /// @return result The Exponentiation of self and rhs
  function pow(FixedPoint memory self, uint256 exponent) internal pure returns (FixedPoint memory result) {
    result = one();
    while (exponent > 0) {
      if (exponent & 1 == 1) {
        result = FP96.mul(result, self);
      }
      self = FP96.mul(self, self);
      exponent >>= 1;
    }
  }

  /// @notice Calculates (1 + x) ^ exponent using ${steps + 1} first terms of Taylor series
  /// @param self The base, must be 1 < self < 2
  /// @param exponent The exponent
  /// @return result The Exponentiation of self and rhs
  function powTaylor(FixedPoint memory self, uint256 exponent) internal pure returns (FixedPoint memory result) {
    uint256 x = self.inner - Q96;
    require(x < Q96, 'WV'); // Wrong value

    uint256 resultX96 = Q96;
    uint256 multiplier;
    uint256 term = Q96;

    uint256 steps = exponent < 3 ? exponent : 3;
    unchecked {
      for (uint256 i; i != steps; ++i) {
        multiplier = ((exponent - i) * x) / (i + 1);
        term = (term * multiplier) / Q96;
        resultX96 += term;
      }
    }

    return FixedPoint({inner: resultX96});
  }

  /// @notice Divide two FixedPoint numbers
  /// @param self The dividend
  /// @param other The divisor
  /// @return result The quotient of self and other
  function div(FixedPoint memory self, FixedPoint memory other) internal pure returns (FixedPoint memory result) {
    result.inner = Math.mulDiv(self.inner, Q96, other.inner);
  }

  function eq(FixedPoint memory self, FixedPoint memory other) internal pure returns (bool) {
    return self.inner == other.inner;
  }

  function ne(FixedPoint memory self, FixedPoint memory other) internal pure returns (bool) {
    return self.inner != other.inner;
  }

  function lt(FixedPoint memory self, FixedPoint memory other) internal pure returns (bool) {
    return self.inner < other.inner;
  }

  function gt(FixedPoint memory self, FixedPoint memory other) internal pure returns (bool) {
    return self.inner > other.inner;
  }

  function le(FixedPoint memory self, FixedPoint memory other) internal pure returns (bool) {
    return self.inner <= other.inner;
  }

  function ge(FixedPoint memory self, FixedPoint memory other) internal pure returns (bool) {
    return self.inner >= other.inner;
  }

  /// @notice Calulates rhs * self
  /// @param self FixedPoint multiplier
  /// @param rhs Integer operand
  /// @return result Integer result
  function mul(FixedPoint memory self, uint256 rhs) internal pure returns (uint256 result) {
    result = Math.mulDiv(self.inner, rhs, Q96);
  }

  function mul(FixedPoint memory self, uint256 rhs, Math.Rounding rounding) internal pure returns (uint256 result) {
    result = Math.mulDiv(self.inner, rhs, Q96, rounding);
  }

  /// @notice Calulates rhs / self
  /// @param self FixedPoint divisor
  /// @param rhs Integer operand
  /// @return result Integer result
  function recipMul(FixedPoint memory self, uint256 rhs) internal pure returns (uint256 result) {
    result = Math.mulDiv(Q96, rhs, self.inner);
  }
}
