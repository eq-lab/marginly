// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

interface IERC20 {
  function decimals() external view returns (uint8);
}

interface ICurve {
  function last_price() external view returns (uint256);

  function ema_price() external view returns (uint256);

  /// @notice returns token_1 / token_0 price.
  /// Price have 18 decimals even if the tokens have different decimals,
  /// or both tokens have same decimals != 18
  function price_oracle() external view returns (uint256);

  /// @notice returns token_(i+1) / token_0 price with 18 decimals.
  function price_oracle(uint256 i) external view returns (uint256);

  function coins(uint256 coinId) external view returns (address);
}

/// @notice Works with pools that implement one of
/// the `price_oracle()` or `price_oracle(uint256 i)` methods,
/// e.g. `StableSwap2EMAOracle`, `CurveTwocryptoOptimized` and `CurveStableSwapNG`.
/// Does not support pools with three or more tokens.
contract CurveOracle is IPriceOracle, Ownable2Step {
  struct OracleParams {
    address pool;
    bool isToken0Quote;
    bool priceOracleMethodHasArg;
    uint8 baseDecimals;
    uint8 quoteDecimals;
  }

  error ZeroPrice();
  error ZeroAddress();
  error InvalidTokenAddress();
  error ExtremeDecimals();

  uint256 private constant X96ONE = 79228162514264337593543950336;
  uint256 private constant PRICE_DECIMALS = 18;
  mapping(address => mapping(address => OracleParams)) public getParams;

  function addPool(
    address pool,
    address quoteToken,
    address baseToken,
    bool priceOracleMethodHasArg
  ) external onlyOwner {
    if (pool == address(0)) revert ZeroAddress();
    if (baseToken == address(0)) revert ZeroAddress();
    if (quoteToken == address(0)) revert ZeroAddress();
    if (quoteToken == baseToken) revert InvalidTokenAddress();

    address coin0 = ICurve(pool).coins(0);
    address coin1 = ICurve(pool).coins(1);

    if (coin0 != baseToken && coin1 != baseToken) revert InvalidTokenAddress();
    if (coin0 != quoteToken && coin1 != quoteToken) revert InvalidTokenAddress();

    uint8 baseDecimals = IERC20(baseToken).decimals();
    uint8 quoteDecimals = IERC20(quoteToken).decimals();

    bool isToken0Quote = coin0 == quoteToken;
    if (isToken0Quote && PRICE_DECIMALS + baseDecimals < quoteDecimals) {
      revert ExtremeDecimals();
    }
    if (!isToken0Quote && PRICE_DECIMALS + quoteDecimals < baseDecimals) {
      revert ExtremeDecimals();
    }

    // price request testing
    _getPriceRaw(pool, priceOracleMethodHasArg);

    OracleParams memory params = OracleParams({
      pool: pool,
      isToken0Quote: isToken0Quote,
      priceOracleMethodHasArg: priceOracleMethodHasArg,
      baseDecimals: baseDecimals,
      quoteDecimals: quoteDecimals
    });

    getParams[quoteToken][baseToken] = params;
  }

  function removePool(address quoteToken, address baseToken) external onlyOwner {
    delete (getParams[quoteToken][baseToken]);
  }

  /// @notice Returns price as X96 value
  function getBalancePrice(address quoteToken, address baseToken) external view returns (uint256) {
    return _getPriceX96(quoteToken, baseToken);
  }

  /// @notice Returns margin call price as X96 value
  function getMargincallPrice(address quoteToken, address baseToken) external view returns (uint256) {
    return _getPriceX96(quoteToken, baseToken);
  }

  function _getPriceX96(address quoteToken, address baseToken) private view returns (uint256 priceX96) {
    if (quoteToken == address(0)) revert ZeroAddress();
    if (baseToken == address(0)) revert ZeroAddress();

    OracleParams storage poolParams = getParams[quoteToken][baseToken];
    if (poolParams.pool == address(0)) revert ZeroAddress();

    uint256 price = _getPriceRaw(poolParams.pool, poolParams.priceOracleMethodHasArg);

    if (poolParams.isToken0Quote) {
      priceX96 = Math.mulDiv(
        price,
        X96ONE,
        10 ** (PRICE_DECIMALS + poolParams.baseDecimals - poolParams.quoteDecimals)
      );
    } else {
      priceX96 = Math.mulDiv(
        10 ** (PRICE_DECIMALS + poolParams.quoteDecimals - poolParams.baseDecimals),
        X96ONE,
        price
      );
    }
  }

  function _getPriceRaw(address pool, bool priceOracleMethodHasArg) private view returns (uint256 price) {
    if (priceOracleMethodHasArg) {
      // get token_1 / token_0 price
      price = ICurve(pool).price_oracle(0);
    } else {
      price = ICurve(pool).price_oracle();
    }
    if (price == 0) revert ZeroPrice();
  }
}
