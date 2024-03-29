// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

interface IERC20 {
  function decimals() external view returns (uint8);
}

interface ICurve {
    function last_price() external view returns (uint256);
    function ema_price() external view returns (uint256);
    function price_oracle() external view returns (uint256);
    function coins(uint256 coinId) external view returns (address);
}

contract CurveEMAPriceOracle is IPriceOracle, Ownable2Step {
  error ZeroPrice();
  error ZeroAddress();
  error InvalidTokenAddress();

  struct OracleParams {
    address pool;
    bool isDirect;
    uint8 baseDecimals;
    uint8 quoteDecimals;
  }

  uint256 private constant X96ONE = 79228162514264337593543950336;
  mapping(address => mapping(address => OracleParams)) public getParams;

  function addPool(address pool, address baseToken, address quoteToken) public onlyOwner {
    if (pool == address(0)) revert ZeroAddress();
    if (baseToken == address(0)) revert ZeroAddress();
    if (quoteToken == address(0)) revert ZeroAddress();
    if (quoteToken == baseToken) revert InvalidTokenAddress();

    address coin0 = ICurve(pool).coins(0);
    address coin1 = ICurve(pool).coins(1);
    
    if (coin0 != baseToken && coin1 != baseToken) revert InvalidTokenAddress();
    if (coin0 != quoteToken && coin1 != quoteToken) revert InvalidTokenAddress();

    OracleParams memory params = OracleParams({
      pool: pool,
      isDirect: coin0 == baseToken,
      baseDecimals: IERC20(baseToken).decimals(),
      quoteDecimals: IERC20(quoteToken).decimals()
    });

    getParams[quoteToken][baseToken] = params;
    getParams[baseToken][quoteToken] = params;
  }

  function removePool(address baseToken, address quoteToken) public onlyOwner {
    delete(getParams[quoteToken][baseToken]);
    delete(getParams[baseToken][quoteToken]);
  }

  /// @notice Returns price as X96 value
  function getBalancePrice(
    address quoteToken,
    address baseToken
  ) external view returns (uint256)
  {
    return _getPriceX96(quoteToken, baseToken);
  }

  /// @notice Returns margin call price as X96 value
  function getMargincallPrice(
    address quoteToken,
    address baseToken
  ) external view returns (uint256)
  {
    return _getPriceX96(quoteToken, baseToken);
  }

  function _getPriceX96(
    address quoteToken,
    address baseToken
  ) internal view returns (uint256 priceX96)
  {
    if (quoteToken == address(0)) revert ZeroAddress();
    if (baseToken == address(0)) revert ZeroAddress();
    
    OracleParams storage poolParams = getParams[baseToken][quoteToken];
    if (poolParams.pool == address(0)) revert ZeroAddress();
    
    uint256 price = ICurve(poolParams.pool).price_oracle();
    if (price == 0) revert ZeroPrice();

    if (!poolParams.isDirect) {
      price = 1e18 - (price - 1e18);
    }

    priceX96 = price * 10**(poolParams.quoteDecimals - poolParams.baseDecimals) * X96ONE;
  }
}
