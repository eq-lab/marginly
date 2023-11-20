// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '../abstract/AdapterStorage.sol';
import '../abstract/UniswapV3LikeSwap.sol';
import '../interfaces/IMarginlyRouter.sol';
import '../libraries/SwapsDecoder.sol';

contract DodoV2Adapter is AdapterStorage, UniswapV3LikeSwap {
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
    IDodoV2Pool dodoV2Pool = IDodoV2Pool(getPoolSafe(tokenIn, tokenOut));

    IMarginlyRouter(msg.sender).adapterCallback(address(dodoV2Pool), amountIn, data);
    amountOut = dodoV2Swap(dodoV2Pool, tokenIn, tokenOut, recipient);

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
    amountIn += (EXACT_OUTPUT_SWAP_RATIO * maxAmountIn) / SwapsDecoder.ONE;

    IDodoV2Pool dodoV2Pool = IDodoV2Pool(getPoolSafe(tokenIn, tokenOut));
    IMarginlyRouter(msg.sender).adapterCallback(address(dodoV2Pool), amountIn, data);
    uint256 dodoV2AmountOut = dodoV2Swap(dodoV2Pool, tokenIn, tokenOut, recipient);
    require(dodoV2AmountOut < amountOut);

    address uniswapV3 = AdapterStorage(RouterStorage(msg.sender).adapters(UNISWAP_V3_ADAPTER_INDEX)).getPool(
      tokenIn,
      tokenOut
    );
    bool zeroForOne = tokenIn < tokenOut;
    CallbackData memory swapData = CallbackData({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      initiator: msg.sender,
      data: data
    });

    (uint256 uniswapAmountIn, ) = uniswapV3LikeSwap(
      recipient,
      uniswapV3,
      zeroForOne,
      -int256(amountOut - dodoV2AmountOut),
      swapData
    );

    amountIn += uniswapAmountIn;
    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  function getDodoV2PoolTokens(IDodoV2Pool dodoPool) private view returns (address baseToken, address quoteToken) {
    baseToken = dodoPool._BASE_TOKEN_();
    quoteToken = dodoPool._QUOTE_TOKEN_();
  }

  function dodoV2Swap(
    IDodoV2Pool pool,
    address tokenIn,
    address tokenOut,
    address recipient
  ) private returns (uint256 amountOut) {
    (address baseToken, address quoteToken) = getDodoV2PoolTokens(pool);
    if (tokenIn == baseToken && tokenOut == quoteToken) {
      amountOut = pool.sellBase(recipient);
    } else if (tokenIn == quoteToken && tokenOut == baseToken) {
      amountOut = pool.sellQuote(recipient);
    } else {
      revert WrongPool(tokenIn, tokenOut, address(pool));
    }
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
}

interface IDodoV2Pool {
  function _BASE_TOKEN_() external view returns (address);

  function _QUOTE_TOKEN_() external view returns (address);

  function sellBase(address to) external returns (uint256 receiveQuoteAmount);

  function sellQuote(address to) external returns (uint256 receiveBaseAmount);
}
