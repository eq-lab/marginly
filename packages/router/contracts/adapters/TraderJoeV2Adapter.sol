// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../abstract/AdapterStorage.sol';
import '../abstract/UniswapV2LikeSwap.sol';
import '../interfaces/IMarginlyRouter.sol';

contract TraderJoeV2Adapter is AdapterStorage {
  error NonZeroSwapAmountLeft();
  error PrecisionLoss();

  constructor(PoolInput[] memory pools) AdapterStorage(pools) {}

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) external returns (uint256 amountOut) {
    ILBPair pool = ILBPair(getPoolSafe(tokenIn, tokenOut));
    address tokenY = address(pool.getTokenY());
    bool swapForY = tokenOut == tokenY;

    if (amountIn > type(uint128).max) revert PrecisionLoss();
    
    uint256 amountInLeft;
    (amountInLeft, amountOut, ) = pool.getSwapOut(uint128(amountIn), swapForY);
    if (amountInLeft != 0) revert NonZeroSwapAmountLeft();
    if (amountOut < minAmountOut) revert InsufficientAmount();
    IMarginlyRouter(msg.sender).adapterCallback(address(pool), amountIn, data);
    pool.swap(swapForY, recipient);
  }

  function swapExactOutput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    bytes calldata data
  ) external returns (uint256 amountIn) {
    ILBPair pool = ILBPair(getPoolSafe(tokenIn, tokenOut));
    address tokenY = address(pool.getTokenY());
    bool swapForY = tokenOut == tokenY;

    if (amountOut > type(uint128).max) revert PrecisionLoss();

    uint256 amountOutLeft;
    (amountIn, amountOutLeft,) = pool.getSwapIn(uint128(amountOut), swapForY);
    if (amountOutLeft != 0) revert NonZeroSwapAmountLeft();
    if (amountIn > maxAmountIn) revert TooMuchRequested();
    IMarginlyRouter(msg.sender).adapterCallback(address(pool), amountOut, data);
    pool.swap(swapForY, recipient);
  }
}

interface ILBPair {
    function getTokenX() external view returns (IERC20 tokenX);

    function getTokenY() external view returns (IERC20 tokenY);

    function getSwapIn(uint128 amountOut, bool swapForY)
        external
        view
        returns (uint128 amountIn, uint128 amountOutLeft, uint128 fee);

    function getSwapOut(uint128 amountIn, bool swapForY)
        external
        view
        returns (uint128 amountInLeft, uint128 amountOut, uint128 fee);

    function swap(bool swapForY, address to) external returns (bytes32 amountsOut);
}
