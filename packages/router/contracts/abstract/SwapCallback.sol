// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import './AdapterStorage.sol';
import '../interfaces/IMarginlyRouter.sol';

struct CallbackData {
  address tokenIn;
  address tokenOut;
  address initiator;
  bytes data;
}

abstract contract SwapCallback is AdapterStorage {
  function swapCallbackInner(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) internal {
    require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
    CallbackData memory data = abi.decode(_data, (CallbackData));
    (address tokenIn, address tokenOut) = (data.tokenIn, data.tokenOut);
    require(msg.sender == getPoolSafe(tokenIn, tokenOut));

    (bool isExactInput, uint256 amountToPay) = amount0Delta > 0
      ? (tokenIn < tokenOut, uint256(amount0Delta))
      : (tokenOut < tokenIn, uint256(amount1Delta));

    require(isExactInput);

    IMarginlyRouter(data.initiator).adapterCallback(msg.sender, amountToPay, data.data);
  }
}
