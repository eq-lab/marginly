// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

contract TestBalancerPool {
  function getPoolId() external pure returns (bytes32) {
    return bytes32(0);
  }
}
