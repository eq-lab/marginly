// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@pendle/core-v2/contracts/router/base/MarketApproxLib.sol';
import '@pendle/core-v2/contracts/interfaces/IPMarket.sol';
import '@pendle/core-v2/contracts/core/StandardizedYield/PYIndex.sol';

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import '../interfaces/IMarginlyRouter.sol';

contract PendleAdapter {
  using PYIndexLib for IPYieldToken;

  event NewPair(address indexed token0, address indexed token1, address pendleMarket, address uniswapV3LikePool);

  error UnknownPool();
  error InsufficientAmount();
  error TooMuchRequested();
  error Forbidden();

  struct PendleMarketData {
    IPMarket market;
    IStandardizedYield sy;
    IPPrincipalToken pt;
    IPYieldToken yt;
    address ib;
    address uniswapV3;
  }

  struct PoolData {
    address pendleMarket;
    address uniswapV3LikePool;
    address ib;
  }

  struct PoolInput {
    PoolData poolData;
    address tokenA;
    address tokenB;
  }

  struct CallbackData {
    bool isExactInput;
    address tokenIn;
    address tokenOut;
    address ibToken;
    address initiator;
    uint256 maxAmountIn;
    bytes data;
  }

  uint256 private constant EPSILON = 1e15;
  uint256 private constant ONE_PLUS_SLIPPAGE = 105;
  uint256 private constant ONE_MINUS_SLIPPAGE = 95;
  uint256 private constant MAX_ITERATIONS = 10;

  uint160 private constant MIN_SQRT_RATIO = 4295128739;
  uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

  mapping(address => mapping(address => PoolData)) public getPoolData;

  constructor(PoolInput[] memory poolsData) {
    PoolInput memory input;
    uint256 length = poolsData.length;
    for (uint256 i; i < length; ) {
      input = poolsData[i];
      getPoolData[input.tokenA][input.tokenB] = input.poolData;
      getPoolData[input.tokenB][input.tokenA] = input.poolData;
      emit NewPair(input.tokenA, input.tokenB, input.poolData.pendleMarket, input.poolData.uniswapV3LikePool);

      unchecked {
        ++i;
      }
    }
  }

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) external returns (uint256 amountOut) {
    PoolData memory poolData = getPoolDataSafe(tokenIn, tokenOut);
    PendleMarketData memory marketData = getMarketData(poolData);

    if (marketData.yt.isExpired()) {
      amountOut = _swapExactInputPostMaturity(marketData, recipient, tokenIn, tokenOut, amountIn, data);
    } else {
      amountOut = _swapExactInputPreMaturity(marketData, recipient, tokenIn, tokenOut, amountIn, minAmountOut, data);
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
    PoolData memory poolData = getPoolDataSafe(tokenIn, tokenOut);
    PendleMarketData memory marketData = getMarketData(poolData);

    if (marketData.yt.isExpired()) {
      amountIn = _swapExactOutputPostMaturity(marketData, recipient, tokenIn, tokenOut, maxAmountIn, amountOut, data);
    } else {
      amountIn = _swapExactOutputPreMaturity(marketData, recipient, tokenIn, tokenOut, maxAmountIn, amountOut, data);
    }

    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  /// @dev callbacks are used in exactOutput swaps only
  function swapCallback(int256 ptToAccount, int256 syToAccount, bytes calldata _data) external {
    // require(ptToAccount > 0 && syToAccount < 0);
    CallbackData memory data = abi.decode(_data, (CallbackData));
    PoolData memory poolData = getPoolDataSafe(data.tokenIn, data.tokenOut);
    require(msg.sender == poolData.pendleMarket);

    if (ptToAccount > 0) {
      // this clause is realized in case of exactOutput with pt tokens as output
      // we need to get ib tokens from uniswapV3 pool, wrap them to sy and send them to pendle
      (, uint256 ibAmountOut) = _uniswapV3LikeSwap(
        address(this),
        poolData.uniswapV3LikePool,
        data.tokenIn < poolData.ib,
        syToAccount,
        _data
      );
      _pendleMintSy(getMarketData(poolData), msg.sender, ibAmountOut);
    } else if (syToAccount > 0) {
      // this clause is realized in case of exactOutput with pt tokens as input
      // we need to send pt tokens from tx initiator to finalize the swap
      IMarginlyRouter(data.initiator).adapterCallback(msg.sender, uint256(-ptToAccount), data.data);
    } else {
      revert();
    }
  }

  function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external {
    require(amount0Delta > 0 || amount1Delta > 0);

    CallbackData memory data = abi.decode(_data, (CallbackData));
    (address tokenIn, address tokenOut) = (data.tokenIn, data.tokenOut);
    PoolData memory poolData = getPoolDataSafe(tokenIn, tokenOut);
    require(msg.sender == poolData.uniswapV3LikePool);

    PendleMarketData memory marketData = getMarketData(poolData);

    if (data.isExactInput) {
      uint256 amountToTransfer = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);
      _pendleRedeemSy(marketData, marketData.uniswapV3, amountToTransfer);
    } else {
      bool toIb = (amount0Delta > 0 && tokenIn > data.ibToken) || (amount1Delta > 0 && tokenIn < data.ibToken);
      if (toIb) {
        // this clause is realized in case of exactOutput with pt tokens as input
        // we need to trigger pendle pt -> sy exactOutput swap and then unwrap sy to ib
        uint256 syAmountOut = _pendleApproxSwapPtForExactSy(
          marketData,
          address(this),
          uint256(amount1Delta),
          data.maxAmountIn,
          _data
        );
        _pendleRedeemSy(marketData, msg.sender, syAmountOut);
      } else {
        // this clause is realized in case of exactOutput with pt tokens as output
        // we need to send tokenIn to uniswapV3 to finalize both tokenIn -> sy and sy -> pt swaps
        uint256 amountToTransfer = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);
        IMarginlyRouter(data.initiator).adapterCallback(msg.sender, amountToTransfer, data.data);
      }
    }
  }

  function getPoolDataSafe(address tokenA, address tokenB) private view returns (PoolData memory poolData) {
    poolData = getPoolData[tokenA][tokenB];
    if (poolData.pendleMarket == address(0)) revert();
  }

  function getMarketData(PoolData memory poolData) private view returns (PendleMarketData memory) {
    IPMarket market = IPMarket(poolData.pendleMarket);
    (IStandardizedYield sy, IPPrincipalToken pt, IPYieldToken yt) = market.readTokens();
    return
      PendleMarketData({
        market: market,
        sy: sy,
        pt: pt,
        yt: yt,
        ib: poolData.ib,
        uniswapV3: poolData.uniswapV3LikePool
      });
  }

  function _swapExactInputPreMaturity(
    PendleMarketData memory marketData,
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) private returns (uint256 amountOut) {
    CallbackData memory swapCallbackData = CallbackData({
      isExactInput: true,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      ibToken: address(marketData.ib),
      initiator: msg.sender,
      maxAmountIn: 0,
      data: data
    });
    if (tokenIn == address(marketData.pt)) {
      // pt to pendle -> sy to ib unwrap -> ib to uniswap -> tokenOut to recipient
      IMarginlyRouter(msg.sender).adapterCallback(address(marketData.market), amountIn, data);
      (uint256 syAmountOut, ) = marketData.market.swapExactPtForSy(address(this), amountIn, '');
      (, amountOut) = _uniswapV3LikeSwap(
        recipient,
        marketData.uniswapV3,
        address(marketData.ib) < tokenOut,
        int256(syAmountOut),
        abi.encode(swapCallbackData)
      );
    } else if (tokenOut == address(marketData.pt)) {
      // tokenIn to uniswap -> ib to sy wrap -> sy to pendle -> pt to recipient
      IMarginlyRouter(msg.sender).adapterCallback(address(marketData.uniswapV3), amountIn, data);
      (, uint256 ibAmountOut) = _uniswapV3LikeSwap(
        address(marketData.market),
        marketData.uniswapV3,
        tokenIn < address(marketData.ib),
        int256(amountIn),
        abi.encode(swapCallbackData)
      );
      uint256 syAmountOut = _pendleMintSy(marketData, marketData.uniswapV3, ibAmountOut);
      amountOut = _pendleApproxSwapExactSyForPt(marketData, recipient, syAmountOut, minAmountOut);
    } else {
      revert();
    }

    if(amountOut < minAmountOut) revert InsufficientAmount();
  }

  function _swapExactOutputPreMaturity(
    PendleMarketData memory marketData,
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    bytes calldata data
  ) private returns (uint256 amountIn) {
    CallbackData memory swapCallbackData = CallbackData({
      isExactInput: false,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      ibToken: address(marketData.ib),
      initiator: msg.sender,
      maxAmountIn: maxAmountIn,
      data: data
    });

    if (tokenOut == address(marketData.pt)) {
      // call pendle -> swapCallback triggers uniswapV3 tokenIn to sy swap -> completing pendle sy to pt swap
      (amountIn, ) = marketData.market.swapSyForExactPt(recipient, amountOut, abi.encode(swapCallbackData));
    } else if (tokenIn == address(marketData.pt)) {
      // call uniswap -> uniswapV3SwapCallback triggers pendle pt to sy swap -> completing uniswap sy to tokenOut swap
      _uniswapV3LikeSwap(
        recipient,
        marketData.uniswapV3,
        address(marketData.ib) < tokenOut,
        -int256(amountOut),
        abi.encode(swapCallbackData)
      );
    } else {
      revert();
    }
  }

  function _swapExactInputPostMaturity(
    PendleMarketData memory marketData,
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    bytes calldata data
  ) private returns (uint256 amountOut) {
    if (tokenIn == address(marketData.pt)) {
      // pt redeem -> sy to uniswap -> tokenOut to recipient
      IMarginlyRouter(msg.sender).adapterCallback(address(this), amountIn, data);

      uint256 syAmountOut = marketData.yt.redeemPY(marketData.uniswapV3);
      // TODO is this even possible?
      if (syAmountOut != amountIn) revert();

      (, amountOut) = _uniswapV3LikeSwap(
        recipient,
        marketData.uniswapV3,
        address(marketData.ib) < tokenOut,
        int256(syAmountOut),
        ''
      );
    } else if (tokenOut == address(marketData.pt)) {
      // sy to pt swap is not possible after maturity
      revert Forbidden();
    } else {
      revert();
    }
  }

  function _swapExactOutputPostMaturity(
    PendleMarketData memory marketData,
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountOut,
    uint256 maxAmountIn,
    bytes calldata data
  ) private returns (uint256 amountIn) {
    CallbackData memory swapCallbackData = CallbackData({
      isExactInput: false,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      ibToken: address(marketData.ib),
      initiator: msg.sender,
      maxAmountIn: maxAmountIn,
      data: data
    });
    if (tokenIn == address(marketData.pt)) {
      // call pendle -> swapCallback triggers uniswapV3 tokenIn/sy swap -> completing pendle swap
      (amountIn, ) = marketData.market.swapSyForExactPt(recipient, amountOut, abi.encode(swapCallbackData));
    } else if (tokenOut == address(marketData.pt)) {
      // sy to pt swap is not possible after maturity
      revert Forbidden();
    } else {
      revert();
    }
  }

  function _uniswapV3LikeSwap(
    address recipient,
    address pool,
    bool zeroForOne,
    int256 swapAmount,
    bytes memory data
  ) internal returns (uint256 amountIn, uint256 amountOut) {
    (int256 amount0Delta, int256 amount1Delta) = IUniswapV3Pool(pool).swap(
      recipient,
      zeroForOne,
      swapAmount,
      zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
      data
    );

    (amountIn, amountOut) = zeroForOne
      ? (uint256(amount0Delta), uint256(-amount1Delta))
      : (uint256(amount1Delta), uint256(-amount0Delta));
  }

  function _pendleApproxSwapExactSyForPt(
    PendleMarketData memory marketData,
    address recipient,
    uint256 syAmountIn,
    uint256 minPtAmountOut
  ) private returns (uint256 ptAmountOut) {
    ApproxParams memory approx = ApproxParams({
      guessMin: minPtAmountOut,
      guessMax: (minPtAmountOut * ONE_PLUS_SLIPPAGE) / ONE_MINUS_SLIPPAGE,
      guessOffchain: 0,
      maxIteration: MAX_ITERATIONS,
      eps: EPSILON
    });

    (ptAmountOut, ) = MarketApproxPtOutLib.approxSwapExactSyForPt(
      marketData.market.readState(address(this)),
      marketData.yt.newIndex(),
      syAmountIn,
      block.timestamp,
      approx
    );

    (uint256 actualAmountIn, ) = marketData.market.swapSyForExactPt(recipient, ptAmountOut, '');
    // TODO do I need to compare actualAmountIn with something?
  }

  function _pendleApproxSwapPtForExactSy(
    PendleMarketData memory marketData,
    address recipient,
    uint256 syAmountOut,
    uint256 maxPtAmountIn,
    bytes memory data
  ) private returns (uint256 ptAmountIn) {
    ApproxParams memory approx = ApproxParams({
      guessMin: (maxPtAmountIn * ONE_MINUS_SLIPPAGE) / ONE_PLUS_SLIPPAGE,
      guessMax: maxPtAmountIn,
      guessOffchain: 0,
      maxIteration: MAX_ITERATIONS,
      eps: EPSILON
    });

    (ptAmountIn, , ) = MarketApproxPtInLib.approxSwapPtForExactSy(
      IPMarket(marketData.market).readState(address(this)),
      marketData.yt.newIndex(),
      syAmountOut,
      block.timestamp,
      approx
    );
    if (ptAmountIn > maxPtAmountIn) revert();

    (uint256 syOut, ) = marketData.market.swapExactPtForSy(recipient, ptAmountIn, data);
    if (syOut < syAmountOut) revert();
  }

  function _pendleMintSy(
    PendleMarketData memory marketData,
    address recipient,
    uint256 ibIn
  ) private returns (uint256 syMinted) {
    // _safeApproveInf(inp.tokenMintSy, SY);
    // TransferHelper.safeApprove(ibToken, sy, ibIn);
    // setting `minSyOut` value as ibIn (1:1 swap)
    syMinted = IStandardizedYield(marketData.sy).deposit(recipient, marketData.ib, ibIn, ibIn);
  }

  function _pendleRedeemSy(
    PendleMarketData memory marketData,
    address recipient,
    uint256 syIn
  ) private returns (uint256 ibRedeemed) {
    // setting `minTokenOut` value as syIn (1:1 swap)
    ibRedeemed = IStandardizedYield(marketData.sy).redeem(recipient, syIn, marketData.ib, syIn, false);
  }
}
