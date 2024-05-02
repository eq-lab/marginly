// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import "../../adapters/interfaces/ICurvePool.sol";

contract TestStableSwap2EMAOraclePool is ICurvePool {
  address public token0;
  address public token1;

  // 1e18 = 1.0 in token0
  uint256 public price = 1e18;
  uint256 private constant PRICE_ONE = 1e18;

  constructor(address _token0, address _token1) {
    token0 = _token0;
    token1 = _token1;
  }

  function setPrice(uint256 _price) public {
    price = _price;
  }

  function exchange(
    int128 i,
    int128 j,
    uint256 _dx,
    uint256 _min_dy,
    address _receiver
  ) external returns (uint256 dy) {
    dy = get_dy(i, j, _dx);

    if (dy < _min_dy) revert("dy < _min_dy");

    TransferHelper.safeTransferFrom(i == 0 ? token0 : token1, msg.sender, address(this), _dx);
    TransferHelper.safeTransfer(j == 0 ? token0 : token1, _receiver, dy);
  }

  function coins(uint256 i) external view returns (address) {
    if (i == 0) {
      return token0;
    } else if (i == 1) {
      return token1;
    }
    revert();
  }

  function get_dy(int128 i, int128 j, uint256 dx) public view returns (uint256 dy) {
    if (i == j || i > 1 || j > 1) revert("wrong indexes");
    if (i == 0) {
      dy = Math.mulDiv(dx, PRICE_ONE, price);
    } else {
      dy = Math.mulDiv(dx, price, PRICE_ONE);
    }
  }

  function price_oracle() external view returns (uint256) {
    return price;
  }

  function last_price() external view returns (uint256) {
    return price;
  }
}
