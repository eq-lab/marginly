// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './RouterStorage.sol';

struct AdapterCallbackData {
  address payer;
  address tokenIn;
  uint256 dexIndex;
}

abstract contract AdapterCallback is RouterStorage {
  /// @inheritdoc IMarginlyRouter
  function adapterCallback(address recipient, uint256 amount, bytes calldata _data) external {
    AdapterCallbackData memory data = abi.decode(_data, (AdapterCallbackData));
    require(msg.sender == adapters[data.dexIndex]);
    TransferHelper.safeTransferFrom(data.tokenIn, data.payer, recipient, amount);
  }
}
