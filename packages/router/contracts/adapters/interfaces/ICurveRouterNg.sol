// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface ICurveRouterNg {
  function exchange(
    address[11] memory route,
    uint256[5][5] memory swapParams,
    uint256 amount,
    uint256 minDy,
    address[5] memory pools,
    address receiver
  ) external returns (uint256);

  function get_dy(
    address[11] memory route,
    uint256[5][5] memory swapParams,
    uint256 amount
  ) external view returns (uint256);

  function get_dx(
    address[11] memory route,
    uint256[5][5] memory swapParams,
    uint256 outAmount,
    address[5] memory pools
  ) external view returns (uint256);
}
