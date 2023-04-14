// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract MockSwapRouter is ISwapRouter {
  uint256 public price = 1500;

  address quoteToken;
  address baseToken;

  constructor(address _quoteToken, address _baseToken) {
    quoteToken = _quoteToken;
    baseToken = _baseToken;
  }

  /// @dev Price of exchange quoteToken to baseToken
  function setExchangePrice(uint256 _price) external {
    price = _price;
  }

  function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
    IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);

    amountOut = params.tokenIn == quoteToken ? params.amountIn / price : params.amountIn * price;
    IERC20(params.tokenOut).transfer(msg.sender, amountOut);
  }

  function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut) {}

  function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn) {}

  function exactOutput(ExactOutputParams calldata params) external payable returns (uint256 amountIn) {}

  function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external override {}
}
