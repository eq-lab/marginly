// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import './TestUniswapPool.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import 'hardhat/console.sol';

contract TestSwapRouter is ISwapRouter {
  address uniswapPool;

  constructor(address _uniswapPool) {
    uniswapPool = _uniswapPool;
  }

  /// @inheritdoc IUniswapV3SwapCallback
  function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external override {}

  /// @inheritdoc ISwapRouter
  function exactInputSingle(
    ExactInputSingleParams calldata params
  ) external payable override returns (uint256 amountOut) {
    uint160 token1ToToken0SqrtPriceX96 = TestUniswapPool(uniswapPool).token1ToToken0SqrtPriceX96();
    uint256 priceX96 = Math.mulDiv(token1ToToken0SqrtPriceX96, token1ToToken0SqrtPriceX96, 2 ** 96);

    if (params.tokenIn == TestUniswapPool(uniswapPool).token0()) {
      priceX96 = Math.mulDiv(2 ** 96, 2 ** 96, priceX96); // price = 1 / price
    }

    amountOut = Math.mulDiv(params.amountIn, 2 ** 96, priceX96);

    IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
    IERC20(params.tokenOut).transfer(msg.sender, amountOut);
  }

  /// @inheritdoc ISwapRouter
  function exactInput(ExactInputParams calldata params) external payable override returns (uint256 amountOut) {
    amountOut = params.amountOutMinimum;
  }

  /// @inheritdoc ISwapRouter
  function exactOutputSingle(
    ExactOutputSingleParams calldata params
  ) external payable override returns (uint256 amountIn) {
    uint160 token1ToToken0SqrtPriceX96 = TestUniswapPool(uniswapPool).token1ToToken0SqrtPriceX96();
    uint256 priceX96 = Math.mulDiv(token1ToToken0SqrtPriceX96, token1ToToken0SqrtPriceX96, 2 ** 96);

    if (params.tokenIn == TestUniswapPool(uniswapPool).token1()) {
      priceX96 = Math.mulDiv(2 ** 96, 2 ** 96, priceX96); // price = 1 / price
    }

    amountIn = Math.mulDiv(params.amountOut, 2 ** 96, priceX96);

    IERC20(params.tokenIn).transferFrom(msg.sender, address(this), amountIn);
    IERC20(params.tokenOut).transfer(msg.sender, params.amountOut);

    require(amountIn <= params.amountInMaximum);
  }

  /// @inheritdoc ISwapRouter
  function exactOutput(ExactOutputParams calldata params) external payable override returns (uint256 amountIn) {
    amountIn = params.amountInMaximum;
  }
}
