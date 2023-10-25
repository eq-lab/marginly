// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../abstract/AdapterStorage.sol';
import '../abstract/SwapCallback.sol';
import '../abstract/UniswapV3LikeSwap.sol';
import '../interfaces/IMarginlyRouter.sol';
import '../libraries/SwapsDecoder.sol';

interface IDODOCallee {
  function dodoCall(bool isBuyBaseToken, uint256 baseAmount, uint256 quoteAmount, bytes calldata data) external;
}

contract DodoV1Adapter is AdapterStorage, UniswapV3LikeSwap, IDODOCallee {
  error WrongPool(address tokenIn, address tokenOut, address pool);

  uint16 constant EXACT_OUTPUT_SWAP_RATIO = 24576; // 0.75 * SwapsDecoder.ONE
  uint256 constant UNISWAP_V3_ADAPTER_INDEX = 0;

  constructor(PoolInput[] memory pools) AdapterStorage(pools) {}

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) external returns (uint256 amountOut) {
    IDodoV1Pool dodoV1Pool = IDodoV1Pool(getPoolSafe(tokenIn, tokenOut));

    CallbackData memory swapCallbackData = CallbackData({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      initiator: msg.sender,
      data: data
    });

    if (isBuyBase(dodoV1Pool, tokenIn, tokenOut)) {
      uint256 dodoV1AmountIn = dodoV1Pool.buyBaseToken(minAmountOut, amountIn, abi.encode(swapCallbackData));
      require(dodoV1AmountIn < amountIn);
      transferOut(tokenOut, recipient, minAmountOut);

      (uint256 uniswapAmountOut, ) = uniswapV3LikeSwap(
        recipient,
        getUniswapV3Pool(tokenIn, tokenOut),
        tokenIn < tokenOut,
        int256(amountIn - dodoV1AmountIn),
        swapCallbackData
      );

      amountOut = minAmountOut + uniswapAmountOut;
    } else {
      amountOut = dodoV1Pool.sellBaseToken(amountIn, minAmountOut, abi.encode(swapCallbackData));
      transferOut(tokenOut, recipient, amountOut);
    }

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
    IDodoV1Pool dodoV1Pool = IDodoV1Pool(getPoolSafe(tokenIn, tokenOut));

    CallbackData memory swapCallbackData = CallbackData({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      initiator: msg.sender,
      data: data
    });

    if (isBuyBase(dodoV1Pool, tokenIn, tokenOut)) {
      amountIn = dodoV1Pool.buyBaseToken(amountOut, maxAmountIn, abi.encode(swapCallbackData));
      transferOut(tokenOut, recipient, amountOut);
    } else {
      amountIn += getDodoV1AmountIn(maxAmountIn);
      uint256 dodoV1AmountOut = dodoV1Pool.sellBaseToken(amountIn, amountOut, abi.encode(swapCallbackData));
      require(dodoV1AmountOut < amountOut);
      transferOut(tokenOut, recipient, dodoV1AmountOut);

      (uint256 uniswapAmountIn, ) = uniswapV3LikeSwap(
        recipient,
        getUniswapV3Pool(tokenIn, tokenOut),
        tokenIn < tokenOut,
        -int256(amountOut - dodoV1AmountOut),
        swapCallbackData
      );

      amountIn += uniswapAmountIn;
    }
    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external {
    require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
    CallbackData memory data = abi.decode(_data, (CallbackData));
    (address tokenIn, address tokenOut) = (data.tokenIn, data.tokenOut);
    address uniswapV3 = AdapterStorage(RouterStorage(data.initiator).adapters(UNISWAP_V3_ADAPTER_INDEX)).getPool(
      tokenIn,
      tokenOut
    );
    require(msg.sender == uniswapV3);

    (bool isExactInput, uint256 amountToPay) = amount0Delta > 0
      ? (tokenIn < tokenOut, uint256(amount0Delta))
      : (tokenOut < tokenIn, uint256(amount1Delta));

    require(isExactInput);

    IMarginlyRouter(data.initiator).adapterCallback(msg.sender, amountToPay, data.data);
  }

  function dodoCall(bool isBuyBaseToken, uint256 baseAmount, uint256 quoteAmount, bytes calldata _data) external {
    CallbackData memory data = abi.decode(_data, (CallbackData));
    (address tokenIn, address tokenOut) = (data.tokenIn, data.tokenOut);
    require(msg.sender == getPoolSafe(tokenIn, tokenOut));

    uint256 amountIn = isBuyBaseToken ? quoteAmount : baseAmount;
    IMarginlyRouter(data.initiator).adapterCallback(address(this), amountIn, data.data);
    SafeERC20.forceApprove(IERC20(tokenIn), msg.sender, amountIn);
  }

  function getDodoV1PoolTokens(IDodoV1Pool dodoPool) private view returns (address baseToken, address quoteToken) {
    baseToken = dodoPool._BASE_TOKEN_();
    quoteToken = dodoPool._QUOTE_TOKEN_();
  }

  function getDodoV1AmountIn(uint256 maxAmountIn) private pure returns (uint256) {
    return (EXACT_OUTPUT_SWAP_RATIO * maxAmountIn) / SwapsDecoder.ONE;
  }

  function getUniswapV3Pool(address tokenA, address tokenB) private view returns (address) {
    return AdapterStorage(RouterStorage(msg.sender).adapters(UNISWAP_V3_ADAPTER_INDEX)).getPool(tokenA, tokenB);
  }

  function transferOut (address token, address recipient, uint256 amount) private {
     SafeERC20.forceApprove(IERC20(token), msg.sender, amount);
    TransferHelper.safeTransfer(token, msg.sender, amount);
  }

  function isBuyBase(IDodoV1Pool dodoV1Pool, address tokenIn, address tokenOut) private view returns (bool) {
    (address baseToken, address quoteToken) = getDodoV1PoolTokens(dodoV1Pool);

    if (tokenIn == quoteToken && tokenOut == baseToken) {
      return true;
    } else if (tokenIn == baseToken && tokenOut == quoteToken) {
      return false;
    } else {
      revert WrongPool(tokenIn, tokenOut, address(dodoV1Pool));
    }
  }
}

interface IDodoV1Pool {
  function _BASE_TOKEN_() external view returns (address);

  function _QUOTE_TOKEN_() external view returns (address);

  function sellBaseToken(
    uint256 amount,
    uint256 minReceiveQuote,
    bytes calldata data
  ) external returns (uint256 receiveQuoteAmount);

  function buyBaseToken(
    uint256 amount,
    uint256 maxPayQuote,
    bytes calldata data
  ) external returns (uint256 receiveBaseAmount);
}
