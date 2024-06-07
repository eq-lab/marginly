// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';

import '@pendle/core-v2/contracts/router/base/MarketApproxLib.sol';
import '@pendle/core-v2/contracts/interfaces/IPMarket.sol';
import '@pendle/core-v2/contracts/core/StandardizedYield/PYIndex.sol';

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import '../interfaces/IMarginlyAdapter.sol';
import '../interfaces/IMarginlyRouter.sol';

/// @dev This adapter is using for swaps PT token (Principal token) to IB token (Interest bearing)  in Pendle Market without trading pools
contract PendleMarketAdapter is IMarginlyAdapter, Ownable2Step {
  using PYIndexLib for IPYieldToken;

  struct PendleMarketData {
    IPMarket market;
    IStandardizedYield sy;
    IPPrincipalToken pt;
    IPYieldToken yt;
    address ib;
    uint8 slippage;
  }

  struct PoolData {
    address pendleMarket;
    address ib;
    uint8 slippage;
  }

  struct PoolInput {
    address pendleMarket;
    uint8 slippage;
    address tokenA;
    address tokenB;
  }

  struct CallbackData {
    address tokenIn;
    address tokenOut;
    address router;
    bytes adapterCallbackData;
  }

  uint256 private constant PENDLE_ONE = 1e18;
  uint256 private constant EPSILON = 1e15;
  uint256 private constant ONE = 100;
  uint256 private constant MAX_ITERATIONS = 10;

  mapping(address => mapping(address => PoolData)) public getPoolData;
  uint256 private callbackAmountIn;

  event NewPair(address indexed token0, address indexed token1, address pendleMarket, address ibToken, uint8 slippage);

  error ApproximationFailed();
  error UnknownPair();
  error WrongPoolInput();

  constructor(PoolInput[] memory poolsData) {
    _addPools(poolsData);
  }

  function addPools(PoolInput[] calldata poolsData) external onlyOwner {
    _addPools(poolsData);
  }

  function sweepDust(address token) external onlyOwner {
    TransferHelper.safeTransfer(token, msg.sender, IERC20(token).balanceOf(address(this)));
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
      amountOut = _swapExactInputPostMaturity(marketData, recipient, tokenIn, amountIn, data);
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
      amountIn = _swapExactOutputPostMaturity(marketData, recipient, tokenIn, amountOut, data);
    } else {
      amountIn = _swapExactOutputPreMaturity(marketData, recipient, tokenIn, tokenOut, maxAmountIn, amountOut, data);
    }

    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  /// @dev Triggered by PendleMarket
  function swapCallback(int256 ptToAccount, int256 syToAccount, bytes calldata _data) external {
    require(ptToAccount > 0 || syToAccount > 0);

    CallbackData memory data = abi.decode(_data, (CallbackData));
    PoolData memory poolData = _getPoolDataSafe(data.tokenIn, data.tokenOut);
    require(msg.sender == poolData.pendleMarket);

    if (syToAccount > 0) {
      // this clause is realized in case of both exactInput and exactOutput with pt tokens as input
      // we need to send pt tokens from router-call initiator to finalize the swap
      IMarginlyRouter(data.router).adapterCallback(msg.sender, uint256(-ptToAccount), data.adapterCallbackData);
    } else {
      // this clause is realized when pt tokens is output
      // we need to redeem ib tokens from pt and transfer them to pendle
      IMarginlyRouter(data.router).adapterCallback(address(this), uint256(-syToAccount), data.adapterCallbackData);
      _pendleMintSy(_getMarketData(poolData), msg.sender, uint256(-syToAccount));
    }
  }

  function _getPoolDataSafe(address tokenA, address tokenB) private view returns (PoolData memory poolData) {
    poolData = getPoolData[tokenA][tokenB];
    if (poolData.pendleMarket == address(0)) revert UnknownPair();
  }

  function _getMarketData(PoolData memory poolData) private view returns (PendleMarketData memory) {
    IPMarket market = IPMarket(poolData.pendleMarket);
    (IStandardizedYield sy, IPPrincipalToken pt, IPYieldToken yt) = market.readTokens();
    return PendleMarketData({market: market, sy: sy, pt: pt, yt: yt, ib: poolData.ib, slippage: poolData.slippage});
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
    if (tokenIn == address(marketData.pt)) {
      // pt to pendle -> sy to ib unwrap and to recipient
      IMarginlyRouter(msg.sender).adapterCallback(address(marketData.market), amountIn, data);
      (uint256 syAmountOut, ) = marketData.market.swapExactPtForSy(address(this), amountIn, new bytes(0));
      amountOut = _pendleRedeemSy(marketData, recipient, syAmountOut);
    } else {
      // tokenIn ib to sy wrap (in swap callback) -> sy to pendle -> pt to recipient
      CallbackData memory swapCallbackData = CallbackData({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        router: msg.sender,
        adapterCallbackData: data
      });
      amountOut = _pendleApproxSwapExactSyForPt(
        marketData,
        recipient,
        amountIn,
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
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      router: msg.sender,
      adapterCallbackData: data
    });

    if (tokenIn == address(marketData.pt)) {
      // approx Pt to Sy -> in callback send Pt to PendleMarket
      // then unwrap Sy to Ib and send to recepient
      (uint256 syAmountOut, uint256 ptAmountIn) = _pendleApproxSwapPtForExactSy(
        marketData,
        address(this),
        amountOut,
        maxAmountIn,
        abi.encode(swapCallbackData)
      );
      amountIn = ptAmountIn;
      // use amountOut here, because actualSyAmountOut a little bit more than amountOut
      _pendleRedeemSy(marketData, recipient, amountOut);

      uint256 dust = syAmountOut - amountOut;
      if (dust > 0) _pendleRedeemSy(marketData, address(this), dust);
    } else {
      // Sy to Pt -> in callback unwrap Sy to Ib and send to pendle market
      (amountIn, ) = marketData.market.swapSyForExactPt(recipient, amountOut, abi.encode(swapCallbackData));
    }
  }

  function _swapExactInputPostMaturity(
    PendleMarketData memory marketData,
    address recipient,
    address tokenIn,
    uint256 amountIn,
    bytes calldata data
  ) private returns (uint256 amountOut) {
    if (tokenIn == address(marketData.pt)) {
      // pt redeem -> sy -> unwrap sy to ib
      uint256 syRedeemed = _redeemPY(marketData.yt, msg.sender, amountIn, data);
      amountOut = _pendleRedeemSy(marketData, recipient, syRedeemed);
    } else {
      // sy to pt swap is not possible after maturity
      revert NotSupported();
    }
  }

  function _swapExactOutputPostMaturity(
    PendleMarketData memory marketData,
    address recipient,
    address tokenIn,
    uint256 amountOut,
    bytes calldata data
  ) private returns (uint256 amountIn) {
    if (tokenIn == address(marketData.pt)) {
      // https://github.com/pendle-finance/pendle-core-v2-public/blob/bc27b10c33ac16d6e1936a9ddd24d536b00c96a4/contracts/core/YieldContractsV2/PendleYieldTokenV2.sol#L301
      uint256 index = marketData.yt.pyIndexCurrent();
      amountIn = Math.mulDiv(amountOut, index, PENDLE_ONE, Math.Rounding.Up);
      uint256 syAmountOut = _redeemPY(marketData.yt, msg.sender, amountIn, data);
      _pendleRedeemSy(marketData, recipient, syAmountOut);
    } else {
      // sy to pt swap is not possible after maturity
      revert NotSupported();
    }
  }

  function _pendleApproxSwapExactSyForPt(
    PendleMarketData memory marketData,
    address recipient,
    uint256 syAmountIn,
    uint256 minPtAmountOut,
    bytes memory data
  ) private returns (uint256 ptAmountOut) {
    uint8 slippage = marketData.slippage;
    ApproxParams memory approx = ApproxParams({
      guessMin: minPtAmountOut,
      guessMax: (minPtAmountOut * (ONE + slippage)) / (ONE - slippage),
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
    if (actualSyAmountIn > syAmountIn) revert ApproximationFailed();
  }

  function _pendleApproxSwapPtForExactSy(
    PendleMarketData memory marketData,
    address recipient,
    uint256 syAmountOut,
    uint256 maxPtAmountIn,
    bytes memory data
  ) private returns (uint256 actualSyAmountOut, uint256 actualPtAmountIn) {
    uint8 slippage = marketData.slippage;
    ApproxParams memory approx = ApproxParams({
      guessMin: (maxPtAmountIn * (ONE - slippage)) / (ONE + slippage),
      guessMax: maxPtAmountIn,
      guessOffchain: 0,
      maxIteration: MAX_ITERATIONS,
      eps: EPSILON
    });

    (actualPtAmountIn, , ) = MarketApproxPtInLib.approxSwapPtForExactSy(
      IPMarket(marketData.market).readState(address(this)),
      marketData.yt.newIndex(),
      syAmountOut,
      block.timestamp,
      approx
    );
    if (actualPtAmountIn > maxPtAmountIn) revert ApproximationFailed();

    (actualSyAmountOut, ) = marketData.market.swapExactPtForSy(recipient, actualPtAmountIn, data);
    if (actualSyAmountOut < syAmountOut) revert ApproximationFailed();
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
        input.pendleMarket == address(0) ||
        input.slippage >= ONE
      ) revert WrongPoolInput();

      (, IPPrincipalToken pt, ) = IPMarket(input.pendleMarket).readTokens();
      address ib;
      if (input.tokenA == address(pt)) {
        ib = input.tokenB;
      } else if (input.tokenB == address(pt)) {
        ib = input.tokenA;
      } else {
        revert WrongPoolInput();
      }
      PoolData memory poolData = PoolData({pendleMarket: input.pendleMarket, ib: ib, slippage: input.slippage});

      getPoolData[input.tokenA][input.tokenB] = poolData;
      getPoolData[input.tokenB][input.tokenA] = poolData;

      emit NewPair(input.tokenA, input.tokenB, input.pendleMarket, ib, input.slippage);

      unchecked {
        ++i;
      }
    }
  }
}
