// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../abstract/AdapterStorage.sol';
import '../interfaces/IMarginlyRouter.sol';
import './interfaces/ICurvePool.sol';

contract CurveAdapter is AdapterStorage {
  constructor(PoolInput[] memory pools) AdapterStorage(pools) {}

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) external returns (uint256 amountOut) {
    address poolAddress = getPoolSafe(tokenIn, tokenOut);
    int128 tokenInIndex = ICurvePool(poolAddress).coins(0) == tokenIn
      ? int128(0)
      : int128(1);

    // move all input tokens from router to this adapter
    IMarginlyRouter(msg.sender).adapterCallback(address(this), amountIn, data);

    amountOut = _swapExactInput(
      poolAddress,
      recipient,
      tokenIn,
      tokenInIndex,
      amountIn,
      minAmountOut
    );

    if (amountOut < minAmountOut) revert InsufficientAmount();
  }

  function swapExactOutput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    bytes calldata data
  ) external returns (uint256 amountIn) {
    address poolAddress = getPoolSafe(tokenIn, tokenOut);

    int128 tokenInIndex = ICurvePool(poolAddress).coins(0) == tokenIn
      ? int128(0)
      : int128(1);

    // move all input tokens from router to this adapter
    IMarginlyRouter(msg.sender).adapterCallback(address(this), maxAmountIn, data);

    // swap all input tokens
    uint256 actualAmountOut = _swapExactInput(
      poolAddress,
      address(this),
      tokenIn,
      tokenInIndex,
      maxAmountIn,
      amountOut
    );

    if (actualAmountOut < amountOut){
      revert TooMuchRequested();
    }

    // move required part of actualAmountOut to recipient
    SafeERC20.safeTransfer(IERC20(tokenOut), recipient, amountOut);

    if (actualAmountOut == amountOut) {
      return maxAmountIn;
    }

    // amount of tokens that need to back swap
    uint256 deltaAmountOut = actualAmountOut - amountOut;

    // swap and move excessive tokenIn directly to recipient.
    // last arg minAmountOut is zero because we made worst allowed by user swap
    // and an additional swap with whichever output only improves it,
    // so the tx shouldn't be reverted
    uint256 excessiveAmountIn = _swapExactInput(
      poolAddress,
      recipient,
      tokenOut,
      1 - tokenInIndex,
      deltaAmountOut,
      0
    );

    amountIn = maxAmountIn - remainedTokenInAmount;
  }

  function _swapExactInput(
    address poolAddress,
    address recipient,
    address tokenIn,
    int128 tokenInIndex,
    uint256 amountIn,
    uint256 minAmountOut
  ) private returns (uint256 amountOut) {
    SafeERC20.forceApprove(IERC20(tokenIn), poolAddress, amountIn);

    amountOut = ICurvePool(poolAddress)
      .exchange(
        tokenInIndex,
        1 - tokenInIndex,
        amountIn,
        minAmountOut,
        recipient
    );
  }
}
