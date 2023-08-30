// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './RouterStorage.sol';

struct AdapterCallbackData {
  address payer;
  address tokenIn;
  uint256 dexIndex;
}

abstract contract AdapterCallback is RouterStorage {
  function adapterCallbackInner(address recipient, uint256 amount, AdapterCallbackData calldata data) internal {
    require(msg.sender == adapters[data.dexIndex]);
    TransferHelper.safeTransferFrom(data.tokenIn, data.payer, recipient, amount);
  }
}
