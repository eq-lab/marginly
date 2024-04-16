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
    bool toIb;
    address tokenIn;
    address tokenOut;
    address initiator;
    uint256 maxAmountIn;
    bytes data;
  }

  uint256 private constant EPSILON = 1e15;
  uint256 private constant ONE_PLUS_SLIPPAGE = 120;
  uint256 private constant ONE_MINUS_SLIPPAGE = 80;
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

  function swapCallback(int256 ptToAccount, int256 syToAccount, bytes calldata _data) external {
    CallbackData memory data = abi.decode(_data, (CallbackData));
    PoolData memory poolData = getPoolDataSafe(data.tokenIn, data.tokenOut);
    require(msg.sender == poolData.pendleMarket);

    if (data.isExactInput) {
      if (ptToAccount > 0) {
        // this clause is realized in case of exactInput with pt tokens as output
        // we need to wrap ib to sy and send them to pendle
        _pendleMintSy(getMarketData(poolData), msg.sender, uint256(-syToAccount));
      } else if (syToAccount > 0) {
        // this clause is realized in case of exactInput with pt tokens as input
        // we need to send pt tokens from tx initiator to finalize the swap
        IMarginlyRouter(data.initiator).adapterCallback(msg.sender, uint256(-ptToAccount), data.data);
      } else {
        revert();
      }
    } else {
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
      if (data.tokenOut == address(marketData.pt)) {
        IMarginlyRouter(data.initiator).adapterCallback(msg.sender, amountToTransfer, data.data);
      } else {
        _pendleRedeemSy(marketData, marketData.uniswapV3, amountToTransfer);
      }
    } else {
      uint256 amountToPay = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);
      if (data.toIb) {
        // this clause is realized in case of exactOutput with pt tokens as input
        // we need to trigger pendle pt -> sy exactOutput swap and then unwrap sy to ib
        uint256 syAmountOut = _pendleApproxSwapPtForExactSy(
          marketData,
          address(this),
          amountToPay,
          data.maxAmountIn,
          _data
        );
        _pendleRedeemSy(marketData, msg.sender, syAmountOut);
      } else {
        // this clause is realized in case of exactOutput with pt tokens as output
        // we need to send tokenIn to uniswapV3 to finalize both tokenIn -> sy and sy -> pt swaps
        IMarginlyRouter(data.initiator).adapterCallback(msg.sender, amountToPay, data.data);
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
    bool ptIsTokenIn = tokenIn == address(marketData.pt);

    CallbackData memory swapCallbackData = CallbackData({
      isExactInput: true,
      toIb: ptIsTokenIn,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      initiator: msg.sender,
      maxAmountIn: 0,
      data: data
    });

    if (ptIsTokenIn) {
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
    } else {
      // tokenIn to uniswap -> ib to sy wrap -> sy to pendle -> pt to recipient
      (, uint256 ibAmountOut) = _uniswapV3LikeSwap(
        address(this),
        marketData.uniswapV3,
        tokenIn < address(marketData.ib),
        int256(amountIn),
        abi.encode(swapCallbackData)
      );
      amountOut = _pendleApproxSwapExactSyForPt(
        marketData,
        recipient,
        ibAmountOut,
        minAmountOut,
        abi.encode(swapCallbackData)
      );
    }

    if (amountOut < minAmountOut) revert InsufficientAmount();
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
    bool ptIsTokenIn = tokenIn == address(marketData.pt);

    CallbackData memory swapCallbackData = CallbackData({
      isExactInput: false,
      toIb: ptIsTokenIn,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      initiator: msg.sender,
      maxAmountIn: maxAmountIn,
      data: data
    });

    if (ptIsTokenIn) {
      // call uniswap -> uniswapV3SwapCallback triggers pendle pt to sy swap -> completing uniswap sy to tokenOut swap
      _uniswapV3LikeSwap(
        recipient,
        marketData.uniswapV3,
        address(marketData.ib) < tokenOut,
        -int256(amountOut),
        abi.encode(swapCallbackData)
      );
    } else {
      // call pendle -> swapCallback triggers uniswapV3 tokenIn to sy swap -> completing pendle sy to pt swap
      (amountIn, ) = marketData.market.swapSyForExactPt(recipient, amountOut, abi.encode(swapCallbackData));
    }

    if (amountIn > maxAmountIn) revert TooMuchRequested();
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

      (, amountOut) = _uniswapV3LikeSwap(
        recipient,
        marketData.uniswapV3,
        address(marketData.ib) < tokenOut,
        int256(syAmountOut),
        ''
      );
    } else {
      // sy to pt swap is not possible after maturity
      revert Forbidden();
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
    if (tokenIn == address(marketData.pt)) {
      // call pendle -> swapCallback triggers uniswapV3 tokenIn/sy swap -> completing pendle swap
      CallbackData memory swapCallbackData = CallbackData({
        isExactInput: false,
        toIb: true,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        initiator: msg.sender,
        maxAmountIn: maxAmountIn,
        data: data
      });
      (amountIn, ) = marketData.market.swapSyForExactPt(recipient, amountOut, abi.encode(swapCallbackData));
    } else {
      // sy to pt swap is not possible after maturity
      revert Forbidden();
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
    uint256 minPtAmountOut,
    bytes memory data
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

    (uint256 actualSyAmountIn, ) = marketData.market.swapSyForExactPt(recipient, ptAmountOut, data);
    require(actualSyAmountIn <= syAmountIn);
  }

  function _pendleApproxSwapPtForExactSy(
    PendleMarketData memory marketData,
    address recipient,
    uint256 syAmountOut,
    uint256 maxPtAmountIn,
    bytes memory data
  ) private returns (uint256 actualSyAmountOut) {
    ApproxParams memory approx = ApproxParams({
      guessMin: (maxPtAmountIn * ONE_MINUS_SLIPPAGE) / ONE_PLUS_SLIPPAGE,
      guessMax: maxPtAmountIn,
      guessOffchain: 0,
      maxIteration: MAX_ITERATIONS,
      eps: EPSILON
    });

    (uint256 ptAmountIn, , ) = MarketApproxPtInLib.approxSwapPtForExactSy(
      IPMarket(marketData.market).readState(address(this)),
      marketData.yt.newIndex(),
      syAmountOut,
      block.timestamp,
      approx
    );
    if (ptAmountIn > maxPtAmountIn) revert();

    (actualSyAmountOut, ) = marketData.market.swapExactPtForSy(recipient, ptAmountIn, data);
    if (actualSyAmountOut < syAmountOut) revert();
  }

  function _pendleMintSy(
    PendleMarketData memory marketData,
    address recipient,
    uint256 ibIn
  ) private returns (uint256 syMinted) {
    TransferHelper.safeApprove(marketData.ib, address(marketData.sy), ibIn);
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
