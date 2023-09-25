// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@marginly/router/contracts/interfaces/IMarginlyRouter.sol';

contract MockSwapRouter is IMarginlyRouter {
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

  function swapExactInput(
    uint256 swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) external returns (uint256 amountOut) {
    IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

    amountOut = tokenIn == quoteToken ? amountIn / price : amountIn * price;
    IERC20(tokenOut).transfer(msg.sender, amountOut);
  }

  function swapExactOutput(
    uint256 swapCalldata,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) external returns (uint256 amountIn) {}

  function adapterCallback(address recipient, uint256 amount, bytes calldata data) external {}
}
