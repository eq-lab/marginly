// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';

import '@pendle/core-v2/contracts/router/base/MarketApproxLib.sol';
import '@pendle/core-v2/contracts/interfaces/IPMarket.sol';
import '@pendle/core-v2/contracts/core/StandardizedYield/PYIndex.sol';

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import '../interfaces/IMarginlyRouter.sol';

contract PendleAdapter is Ownable2Step {
  using PYIndexLib for IPYieldToken;

  event NewPair(
    address indexed token0,
    address indexed token1,
    address pendleMarket,
    address uniswapV3LikePool,
    address ibToken
  );

  error WrongPoolInput();
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
    address router;
    uint256 approxLimit;
    bytes adapterCallbackData;
  }

  uint256 private constant PENDLE_ONE = 1e18;
  uint256 private constant EPSILON = 1e15;
  uint256 private constant ONE_PLUS_SLIPPAGE = 120;
  uint256 private constant ONE_MINUS_SLIPPAGE = 80;
  uint256 private constant MAX_ITERATIONS = 10;

  uint160 private constant MIN_SQRT_RATIO = 4295128739;
  uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

  mapping(address => mapping(address => PoolData)) public getPoolData;

  constructor(PoolInput[] memory poolsData) {
    _addPools(poolsData);
  }

  function addPools(PoolInput[] calldata poolsData) external onlyOwner {
    _addPools(poolsData);
  }

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) external returns (uint256 amountOut) {
    PoolData memory poolData = _getPoolDataSafe(tokenIn, tokenOut);
    PendleMarketData memory marketData = _getMarketData(poolData);

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
    PoolData memory poolData = _getPoolDataSafe(tokenIn, tokenOut);
    PendleMarketData memory marketData = _getMarketData(poolData);

    if (marketData.yt.isExpired()) {
      amountIn = _swapExactOutputPostMaturity(marketData, recipient, tokenIn, tokenOut, maxAmountIn, amountOut, data);
    } else {
      amountIn = _swapExactOutputPreMaturity(marketData, recipient, tokenIn, tokenOut, maxAmountIn, amountOut, data);
    }

    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  function swapCallback(int256 ptToAccount, int256 syToAccount, bytes calldata _data) external {
    require(ptToAccount > 0 || syToAccount > 0);

    CallbackData memory data = abi.decode(_data, (CallbackData));
    PoolData memory poolData = _getPoolDataSafe(data.tokenIn, data.tokenOut);
    require(msg.sender == poolData.pendleMarket);

    if (syToAccount > 0) {
      // this clause is realized in case of both exactInput and exactOutput with pt tokens as input
      // we need to send pt tokens from router-call initiator to finalize the swap
      IMarginlyRouter(data.router).adapterCallback(msg.sender, uint256(-ptToAccount), data.adapterCallbackData);
    } else if (data.isExactInput) {
      // this clause is realized in case of exactInput with pt tokens as output
      // we need to redeem ib tokens from pt and transfer them to uniswap
      _pendleMintSy(_getMarketData(poolData), msg.sender, uint256(-syToAccount));
    } else {
      // this clause is realized in case of exactOutput with pt tokens as output
      // we need to get ib tokens from uniswapV3 pool, wrap them to sy and send them to pendle
      (, uint256 ibAmountOut) = _uniswapV3LikeSwap(
        address(this),
        poolData.uniswapV3LikePool,
        data.tokenIn < poolData.ib,
        syToAccount,
        _data
      );
      _pendleMintSy(_getMarketData(poolData), msg.sender, ibAmountOut);
    }
  }

  function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external {
    require(amount0Delta > 0 || amount1Delta > 0);

    CallbackData memory data = abi.decode(_data, (CallbackData));
    (address tokenIn, address tokenOut) = (data.tokenIn, data.tokenOut);
    PoolData memory poolData = _getPoolDataSafe(tokenIn, tokenOut);
    require(msg.sender == poolData.uniswapV3LikePool);

    PendleMarketData memory marketData = _getMarketData(poolData);
    uint256 amountToPay = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);

    if (tokenOut == address(marketData.pt)) {
      // this clause is realized in case of both exactInput and exactOutput with pt tokens as output
      // we need to send tokenIn to uniswapV3 to finalize both tokenIn -> sy and sy -> pt swaps
      IMarginlyRouter(data.router).adapterCallback(msg.sender, amountToPay, data.adapterCallbackData);
    } else if (data.isExactInput) {
      // this clause is realized in case of exactInput with pt tokens as input
      // we need to trigger pendle pt -> sy exactOutput swap and then unwrap sy to ib
      _pendleRedeemSy(marketData, msg.sender, amountToPay);
    } else {
      // this clause is realized in case of exactOutput with pt tokens as input
      // before the maturity we need to trigger pendle pt -> sy exactOutput swap and then unwrap sy to ib
      // after the maturity we need to redeem sy tokens and then unwrap them to ib
      uint256 syAmountOut;
      if (marketData.yt.isExpired()) {
        // https://github.com/pendle-finance/pendle-core-v2-public/blob/bc27b10c33ac16d6e1936a9ddd24d536b00c96a4/contracts/core/YieldContractsV2/PendleYieldTokenV2.sol#L301
        uint256 index = marketData.yt.pyIndexCurrent();
        uint256 transferPtAmount = Math.mulDiv(amountToPay, index, PENDLE_ONE, Math.Rounding.Up);

        syAmountOut = _redeemPY(marketData.yt, data.router, transferPtAmount, data.adapterCallbackData);
      } else {
        syAmountOut = _pendleApproxSwapPtForExactSy(marketData, address(this), amountToPay, data.approxLimit, _data);
      }
      _pendleRedeemSy(marketData, msg.sender, syAmountOut);
    }
  }

  function _getPoolDataSafe(address tokenA, address tokenB) private view returns (PoolData memory poolData) {
    poolData = getPoolData[tokenA][tokenB];
    if (poolData.pendleMarket == address(0)) revert();
  }

  function _getMarketData(PoolData memory poolData) private view returns (PendleMarketData memory) {
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
      router: msg.sender,
      approxLimit: 0,
      adapterCallbackData: data
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
      router: msg.sender,
      approxLimit: maxAmountIn,
      adapterCallbackData: data
    });

    if (tokenIn == address(marketData.pt)) {
      // call uniswap -> uniswapV3SwapCallback triggers pendle pt to sy swap -> completing uniswap ib to tokenOut swap
      _uniswapV3LikeSwap(
        recipient,
        marketData.uniswapV3,
        address(marketData.ib) < tokenOut,
        -int256(amountOut),
        abi.encode(swapCallbackData)
      );
    } else {
      // call pendle -> swapCallback triggers uniswapV3 tokenIn to ib swap -> completing pendle sy to pt swap
      (amountIn, ) = marketData.market.swapSyForExactPt(recipient, amountOut, abi.encode(swapCallbackData));
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
      uint256 syAmountOut = _redeemPY(marketData.yt, msg.sender, amountIn, data);

      CallbackData memory swapCallbackData = CallbackData({
        isExactInput: true,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        router: msg.sender,
        approxLimit: 0,
        adapterCallbackData: data
      });

      (, amountOut) = _uniswapV3LikeSwap(
        recipient,
        marketData.uniswapV3,
        address(marketData.ib) < tokenOut,
        int256(syAmountOut),
        abi.encode(swapCallbackData)
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
    uint256 maxAmountIn,
    uint256 amountOut,
    bytes calldata data
  ) private returns (uint256 amountIn) {
    if (tokenIn == address(marketData.pt)) {
      CallbackData memory swapCallbackData = CallbackData({
        isExactInput: false,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        router: msg.sender,
        approxLimit: maxAmountIn,
        adapterCallbackData: data
      });
      // call uniswap -> uniswapV3SwapCallback triggers pendle pt to sy swap -> completing uniswap ib to tokenOut swap
      (amountIn, ) = _uniswapV3LikeSwap(
        recipient,
        marketData.uniswapV3,
        address(marketData.ib) < tokenOut,
        -int256(amountOut),
        abi.encode(swapCallbackData)
      );
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

  function _redeemPY(
    IPYieldToken yt,
    address router,
    uint256 ptAmount,
    bytes memory adapterCallbackData
  ) private returns (uint256 syRedeemed) {
    IMarginlyRouter(router).adapterCallback(address(yt), ptAmount, adapterCallbackData);
    syRedeemed = yt.redeemPY(address(this));
  }

  function _addPools(PoolInput[] memory poolsData) private {
    PoolInput memory input;
    uint256 length = poolsData.length;
    for (uint256 i; i < length; ) {
      input = poolsData[i];

      if (
        input.tokenA == address(0) ||
        input.tokenB == address(0) ||
        input.poolData.pendleMarket == address(0) ||
        input.poolData.uniswapV3LikePool == address(0) ||
        input.poolData.ib == address(0)
      ) revert WrongPoolInput();

      (, IPPrincipalToken pt, ) = IPMarket(input.poolData.pendleMarket).readTokens();
      if (input.tokenA != address(pt) && input.tokenB != address(pt)) revert WrongPoolInput();

      getPoolData[input.tokenA][input.tokenB] = input.poolData;
      getPoolData[input.tokenB][input.tokenA] = input.poolData;
      emit NewPair(
        input.tokenA,
        input.tokenB,
        input.poolData.pendleMarket,
        input.poolData.uniswapV3LikePool,
        input.poolData.ib
      );

      unchecked {
        ++i;
      }
    }
  }
}
