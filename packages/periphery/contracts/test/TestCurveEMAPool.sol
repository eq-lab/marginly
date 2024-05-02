// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

contract TestCurveEMAPool {
  address public _coin0;
  address public _coin1;

  uint256 public _last_price = 0;
  uint256 public _ema_price = 0;
  uint256 public _price_oracle = 0;

  constructor(address coin0, address coin1) {
    _coin0 = coin0;
    _coin1 = coin1;
  }

  function coins(uint256 coinId) external view returns (address) {
    require(coinId < 2, "coinId must be 0 or 1");
    if (coinId == 0) {
      return _coin0;
    }
    return _coin1;
  }

  function setPrices(
    uint256 last_price,
    uint256 ema_price,
    uint256 price_oracle
  ) external
  {
    _last_price = last_price;
    _ema_price = ema_price;
    _price_oracle = price_oracle;
  }

  function last_price() external view returns (uint256) {
    return _last_price;
  }

  function ema_price() external view returns (uint256) {
    return _ema_price;
  }

  function price_oracle() external view returns (uint256) {
    return _price_oracle;
  }
}
